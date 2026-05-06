import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const MOCK_LOGS = [
  "[10:44:12] _auth_token_refreshed_uid_894",
  "[10:44:14] DB_COMPACTION_TRIGGERED",
  "[10:44:15] request /api/links (200 OK) 14ms",
  "[10:44:19] [WARN] rate_limit_approaching endpoint=/users",
  "[10:44:21] worker_node_04 heartbeat ACK",
  "[10:44:23] _cart_items_synced_uid_102",
  "[10:44:28] request /api/health (200 OK) 4ms",
  "[10:44:31] [WARN] elevated CPU usage on node_02",
  "[10:44:34] _admin_session_established",
  "[10:44:38] new_link_saved domain=github.com",
];

const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padEnd(6, '0')

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)

  // Validate session presence visually (we can assume the login handler did this)
  useEffect(() => {
    if (localStorage.getItem('isAdminUnlocked') !== 'true') {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    const logsInterval = setInterval(() => {
      const msg = MOCK_LOGS[Math.floor(Math.random() * MOCK_LOGS.length)];
      const ts = new Date().toISOString().split('T')[1].replace('Z', '');
      
      setLogs(prev => {
        const newLogs = [...prev, `[${ts}] ${msg} | seq_${randomHex()}`];
        if (newLogs.length > 60) newLogs.shift();
        return newLogs;
      });
    }, 1000 + Math.random() * 2000);

    return () => clearInterval(logsInterval);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs]);

  const sparklinePath1 = "M 0 30 L 10 25 L 20 28 L 30 15 L 40 20 L 50 5 L 60 10 L 70 8 L 80 15"
  const sparklinePath2 = "M 0 10 L 10 15 L 20 5 L 30 20 L 40 25 L 50 15 L 60 5 L 70 12 L 80 8"
  const sparklinePath3 = "M 0 20 L 10 25 L 20 15 L 30 5 L 40 10 L 50 25 L 60 20 L 70 15 L 80 5"

  // Big graph mock path
  const generateMainGraph = () => {
    let path = "M 0 100 "
    for(let i = 1; i <= 100; i++) {
        const y = 80 + Math.sin(i * 0.2) * 20 + Math.random() * 15 - 50;
        path += `L ${i * (800/100)} ${y} `
    }
    return path;
  }

  const renderProgressBar = (label, percentage) => {
    const totalBars = 30;
    const filledBars = Math.floor((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span>{label}</span>
        <span>[{'|'.repeat(filledBars)}{'.'.repeat(emptyBars)}] {percentage}%</span>
      </div>
    )
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
      textTransform: 'lowercase',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      
      {/* Top Navbar (similar to app but god mode) */}
      <header style={{
        padding: '10px 16px',
        borderBottom: '1px solid #fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        minHeight: '74px'
      }}>
        <div style={{ whiteSpace: 'pre', fontSize: '0.65rem', lineHeight: '1.1', opacity: 0.9 }}>
{`
  ____   _____  _____  _____       ____  ____  ____  ____  ____  ____ 
 |  _ \\ /  _  \\/  _  \\|_   _|     /  _ \\/   _\\/   _\\/  __\\/ ___\\/ ___\\
 | |_) || | | || | | |  | |       | / \\||  /  |  /  |  \\/||    \\|    \\
 |  _ < | |_| || |_| |  | |       | |-|||  \\_ |  \\_ |  __/\\___ |\\___ |
 |_| \\_\\\\_____/\\_____/  |_|       \\_/ \\|\\____/\\____/\\____/\\____/\\____/
`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', fontSize: '0.85rem' }}>
          <div>[ status: online ]</div>
          <div style={{ color: '#888' }}>uptime: {Math.floor(Date.now() / 1000000 % 1000)}h {Math.floor(Date.now() / 60000 % 60)}m</div>
          <button 
            type="button" 
            onClick={() => {
              localStorage.removeItem('isAdminUnlocked')
              navigate('/login')
            }}
            style={{ 
              background: 'none', border: '1px solid #333', color: '#888', cursor: 'pointer', 
              padding: '2px 8px', marginTop: '4px', fontFamily: 'inherit', fontSize: '0.75rem' 
            }}
          >
            close_connection
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div style={{
        flex: 1,
        padding: '16px',
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        gap: '16px',
        overflowY: 'auto'
      }}>

        {/* Top Row: Mini Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            { label: 'total_users', val: '1042', p: sparklinePath1 },
            { label: 'db_reads/m', val: '45.2k', p: sparklinePath2 },
            { label: 'active_sessions', val: '12', p: sparklinePath3 },
            { label: 'api_latency', val: '14ms', p: sparklinePath1 }
          ].map((stat, i) => (
            <div key={i} style={{ border: '1px solid #fff', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '8px' }}>{stat.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stat.val}</div>
              <svg width="100%" height="30" style={{ marginTop: '12px' }}>
                <path d={stat.p} stroke="#555" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          ))}
        </div>

        {/* Middle Row: Main Graph + Resource Monitor */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
          
          <div style={{ border: '1px solid #fff', padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '16px' }}>database traffic over 24h</div>
            <div style={{ flex: 1, position: 'relative', minHeight: '180px', borderLeft: '1px solid #333', borderBottom: '1px solid #333' }}>
              <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 800 100" style={{ position: 'absolute', top: 0, left: 0 }}>
                <path d={generateMainGraph()} stroke="#fff" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* Gridlines vertical */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '25%', borderLeft: '1px dashed #222' }}></div>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: '1px dashed #222' }}></div>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '75%', borderLeft: '1px dashed #222' }}></div>
            </div>
          </div>

          <div style={{ border: '1px solid #fff', padding: '12px', fontSize: '0.85rem' }}>
            <div style={{ color: '#888', marginBottom: '16px' }}>resource_monitor</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {renderProgressBar('cpu_load', 64)}
              {renderProgressBar('memory_allocation', 32)}
              {renderProgressBar('storage_capacity', 88)}
              {renderProgressBar('network_bandwidth', 41)}
            </div>
            <div style={{ marginTop: '24px', borderTop: '1px dashed #333', paddingTop: '12px', color: '#888' }}>
              node_01: operating normally<br/>
              node_02: elevated thermal<br/>
              edge_cache: synchronized
            </div>
          </div>

        </div>

        {/* Bottom Row: Data Matrix & Live Logs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr', gap: '16px', minHeight: '300px' }}>
          
          <div style={{ border: '1px solid #fff', padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '12px' }}>recent_system_events</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #fff' }}>
                  <th style={{ padding: '8px 4px' }}>id</th>
                  <th style={{ padding: '8px 4px' }}>event_type</th>
                  <th style={{ padding: '8px 4px' }}>target</th>
                  <th style={{ padding: '8px 4px' }}>status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px dashed #333' }}>
                  <td style={{ padding: '8px 4px', color: '#888' }}>evt_883</td>
                  <td style={{ padding: '8px 4px' }}>auth_verify</td>
                  <td style={{ padding: '8px 4px' }}>usr_849</td>
                  <td style={{ padding: '8px 4px' }}>[ok]</td>
                </tr>
                <tr style={{ borderBottom: '1px dashed #333' }}>
                  <td style={{ padding: '8px 4px', color: '#888' }}>evt_884</td>
                  <td style={{ padding: '8px 4px' }}>db_write</td>
                  <td style={{ padding: '8px 4px' }}>links_col</td>
                  <td style={{ padding: '8px 4px' }}>[ok]</td>
                </tr>
                <tr style={{ borderBottom: '1px dashed #333' }}>
                  <td style={{ padding: '8px 4px', color: '#888' }}>evt_885</td>
                  <td style={{ padding: '8px 4px' }}>db_compaction</td>
                  <td style={{ padding: '8px 4px' }}>system_task</td>
                  <td style={{ padding: '8px 4px', color: '#888' }}>[running]</td>
                </tr>
                <tr style={{ borderBottom: '1px dashed #333' }}>
                  <td style={{ padding: '8px 4px', color: '#888' }}>evt_886</td>
                  <td style={{ padding: '8px 4px' }}>node_ping</td>
                  <td style={{ padding: '8px 4px' }}>edge_us_east</td>
                  <td style={{ padding: '8px 4px' }}>[timeout]</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 4px', color: '#888' }}>evt_887</td>
                  <td style={{ padding: '8px 4px' }}>auth_token_iss</td>
                  <td style={{ padding: '8px 4px' }}>usr_112</td>
                  <td style={{ padding: '8px 4px' }}>[ok]</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ border: '1px solid #fff', padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '8px' }}>live_terminal_feed</div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              fontSize: '0.8rem', 
              color: '#bbb',
              scrollbarWidth: 'none',  // Firefox
              msOverflowStyle: 'none', // IE and Edge
            }}>
              {/* Hide scrollbar for Chrome/Safari/Webkit internally via standard CSS, but inline we use this trick */}
              <style dangerouslySetInnerHTML={{__html: `
                .log-container::-webkit-scrollbar { display: none; }
              `}} />
              
              <div className="log-container" style={{ height: '100%', overflowY: 'auto' }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ padding: '2px 0' }}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
