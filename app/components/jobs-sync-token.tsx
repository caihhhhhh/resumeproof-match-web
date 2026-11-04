'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function JobsSyncToken() {
  const [status, setStatus] = useState<Status>('idle');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function createToken() {
    setStatus('loading');
    setError('');
    try {
      const response = await fetch('/api/jobs/sync-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = await response.json().catch(() => ({})) as { token?: unknown };
      if (!response.ok || typeof payload.token !== 'string') {
        setError(response.status === 401 ? '请先登录再生成令牌。' : '生成失败，请稍后再试。');
        setStatus('error');
        return;
      }
      setToken(payload.token);
      setStatus('ready');
    } catch {
      setError('网络异常，请稍后再试。');
      setStatus('error');
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="jobs-token">
      <div className="jobs-token-head">
        <div>
          <h2>把平台岗位同步进来</h2>
          <p>在 BOSS、智联、猎聘 的搜索结果页点一次「采集本页」，岗位会先落在本机；再用令牌同步到你的账号。</p>
        </div>
        <button type="button" onClick={createToken} disabled={status === 'loading'}>
          {status === 'loading' ? '生成中…' : '生成同步令牌'}
        </button>
      </div>

      {token ? (
        <div className="jobs-token-value">
          <code>{token}</code>
          <button type="button" onClick={copyToken}>{copied ? '已复制' : '复制'}</button>
        </div>
      ) : null}

      {error ? <p className="jobs-token-error" role="alert">{error}</p> : null}

      <ol className="jobs-token-steps">
        <li>安装 <a href="/downloads/resumeproof-capture.zip" download>采集扩展</a>（解压后在 Chrome 开发者模式 → 加载已解压的扩展程序；<a href="/extension">安装说明</a>）。</li>
        <li>启动本机桥：<code>node scripts/jobs/bridge.mjs</code>，默认监听 127.0.0.1:7717。</li>
        <li>在平台搜索页点「采集本页」，再运行 <code>node scripts/jobs/bridge.mjs sync --token &lt;令牌&gt; --site &lt;站点地址&gt;</code>。</li>
      </ol>
      <p className="jobs-token-note">令牌等同于你的同步权限，只显示一次；不要发给别人。平台登录态始终留在你自己的浏览器里。</p>
    </div>
  );
}
