import React, { useState } from 'react';
import './App.css';

interface Video {
  id: number;
  title: string;
  duration: string;
  thumbnail: string;
  tier: 'free' | 'pro' | 'enterprise';
  views: string;
}

const VIDEOS: Video[] = [
  { id: 1, title: 'Getting Started with Cloud Architecture', duration: '14:32', thumbnail: '🎬', tier: 'free', views: '12.4K' },
  { id: 2, title: 'Kubernetes Deep Dive — Production Setup', duration: '42:10', thumbnail: '🐳', tier: 'pro', views: '8.1K' },
  { id: 3, title: 'AWS ECS vs EKS — When to Use Which', duration: '28:55', thumbnail: '☁️', tier: 'free', views: '21.7K' },
  { id: 4, title: 'Zero Downtime Deployments with Blue/Green', duration: '35:22', thumbnail: '🚀', tier: 'pro', views: '6.3K' },
  { id: 5, title: 'Building Observability Platforms on Fargate', duration: '51:08', thumbnail: '📊', tier: 'enterprise', views: '3.9K' },
  { id: 6, title: 'GitOps with ArgoCD — End to End', duration: '44:17', thumbnail: '⚙️', tier: 'pro', views: '9.2K' },
];

const TIER_COLORS: Record<string, string> = {
  free: '#22c55e',
  pro: '#6366f1',
  enterprise: '#f59e0b',
};

function App() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = VIDEOS.filter(v => {
    const matchesTier = activeFilter === 'all' || v.tier === activeFilter;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">▶ StreamFlow</div>
          <input
            className="search"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <div className="user-badge">Pro</div>
        </div>
      </header>

      <main className="main">
        <div className="hero">
          <h1>Video Streaming Platform</h1>
          <p>Infrastructure built on AWS ECS Fargate · CloudFront · S3</p>
        </div>

        <div className="filters">
          {['all', 'free', 'pro', 'enterprise'].map(f => (
            <button
              key={f}
              className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid">
          {filtered.map(video => (
            <div key={video.id} className="card">
              <div className="thumbnail">{video.thumbnail}</div>
              <div className="card-body">
                <div className="card-title">{video.title}</div>
                <div className="card-meta">
                  <span>{video.duration}</span>
                  <span>{video.views} views</span>
                  <span
                    className="tier-badge"
                    style={{ color: TIER_COLORS[video.tier] }}
                  >
                    {video.tier.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty">No videos found for "{searchQuery}"</div>
        )}
      </main>

      <footer className="footer">
        <p>StreamFlow · Deployed on AWS ECS Fargate · Environment: {process.env.REACT_APP_ENV || 'Development'}</p>
      </footer>
    </div>
  );
}

export default App;
