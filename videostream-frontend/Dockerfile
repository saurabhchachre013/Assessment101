# (a) ENTRYPOINT vs CMD:
#   - ENTRYPOINT sets the executable that will always run when the container starts.
#   - CMD provides default arguments to ENTRYPOINT or, if ENTRYPOINT is not set, the default command to run.
#
# (b) If someone overrides the command in the ECS Task Definition, which one takes effect?
#   - ECS Task Definition's "command" overrides the container's CMD arguments. If an ENTRYPOINT is defined,
#     the task "command" replaces CMD (i.e., it is passed as arguments to ENTRYPOINT). If the task specifies
#     an entrypoint explicitly, that overrides the image's ENTRYPOINT. In short: Task-level entrypoint/command
#     take precedence and are applied to the image's ENTRYPOINT/CMD semantics.
#
# Steps taken to keep the final image under 150MB:
#  - Use a multi-stage build: build with a Node image, but copy only the production build output to the final image.
#  - Use `nginx:alpine` (small base) for the final stage.
#  - Do not copy source files or node_modules into the final image; only `dist` is copied.
#  - Do not install devDependencies in the final image.
#  - Keep configuration minimal and avoid adding language runtimes to the final stage.

#First stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

### Final stage
FROM nginx:alpine

# Create non-root user and group
RUN addgroup -S applicationgroup && adduser -S appuser -G applicationgroup

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

# Ensure runtime directories exist and are writable by the non-root user
RUN mkdir -p /var/run /var/log/nginx /var/cache/nginx /tmp \
  && rm -f /tmp/nginx.pid \
  && chown -R appuser:applicationgroup /usr/share/nginx/html /var/run /var/log/nginx /var/cache/nginx /etc/nginx/conf.d /tmp
  
EXPOSE 8080

USER appuser

CMD ["nginx", "-g", "daemon off;"]


