import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { ExternalLink, MoreVertical, Trash2, Globe, Star, Edit2, ChevronUp, ChevronDown } from 'lucide-react';

export default function LinkStorer({ collectionName = 'saved_links', title = 'Saved Links', isActive = true, user }) {
  const [url, setUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Custom Modal State
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, collectionName)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort logic combining both createdAt asc + favorites
      data.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      });
      
      setLinks(data);
    });
    
    let storageListener = null;

    // Check initial pending website from background script
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pendingWebsiteAdd'], (result) => {
        if (result.pendingWebsiteAdd) {
          const { url, title } = result.pendingWebsiteAdd;
          setUrl(url || '');
          setNickname(title || '');
          setIsFormOpen(true);
          chrome.storage.local.remove('pendingWebsiteAdd');
        }
      });

      // Listen for commands triggering when panel is already open
      storageListener = (changes, areaName) => {
        if (areaName === 'local' && changes.pendingWebsiteAdd && changes.pendingWebsiteAdd.newValue) {
          const { url, title } = changes.pendingWebsiteAdd.newValue;
          setUrl(url || '');
          setNickname(title || '');
          setIsFormOpen(true);
          chrome.storage.local.remove('pendingWebsiteAdd');
        }
      };
      
      chrome.storage.onChanged.addListener(storageListener);
    }

    return () => {
      unsub();
      if (storageListener && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, [collectionName, user]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isActive) return;
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const keyIndex = parseInt(e.key) - 1;
      if (!isNaN(keyIndex) && keyIndex >= 0 && keyIndex < 9) {
        if (links[keyIndex]) {
          handleOpen(links[keyIndex].url);
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [links, isActive]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim() || !nickname.trim() || !user) return;

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    let domain = '';
    try {
      const urlObj = new URL(cleanUrl);
      domain = urlObj.hostname;
    } catch (err) {
      domain = cleanUrl;
    }

    setIsSubmitting(true);
    await addDoc(collection(db, 'users', user.uid, collectionName), {
      url: cleanUrl,
      nickname: nickname.trim(),
      description: description.trim(),
      domain: domain,
      isFavorite: false,
      createdAt: serverTimestamp()
    });
    setUrl('');
    setNickname('');
    setDescription('');
    setIsSubmitting(false);
  };

  const handleOpen = (linkUrl, newWindow = false) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      if (newWindow) {
        chrome.windows.create({ url: linkUrl });
      } else {
        chrome.tabs.create({ url: linkUrl });
      }
    } else {
      window.open(linkUrl, '_blank');
    }
    setActiveMenu(null);
  };

  const toggleFavorite = async (id, currentFav) => {
    await updateDoc(doc(db, 'users', user.uid, collectionName, id), {
      isFavorite: !currentFav
    });
  };

  const requestDelete = (id) => {
    setPendingDelete(id);
    setActiveMenu(null);
  }

  const confirmDelete = async () => {
    if (pendingDelete) {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, pendingDelete));
      setPendingDelete(null);
    }
  };

  const requestEdit = (link) => {
    setEditingItem({ id: link.id, nickname: link.nickname, description: link.description || '' });
    setActiveMenu(null);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editingItem.nickname.trim()) return;
    
    await updateDoc(doc(db, 'users', user.uid, collectionName, editingItem.id), {
       nickname: editingItem.nickname.trim(),
       description: editingItem.description.trim()
    });
    setEditingItem(null);
  };

  const handleMoveUp = async (e, index) => {
    e.stopPropagation();
    if (index <= 0) return;
    const current = links[index];
    const prev = links[index - 1];
    if (current.isFavorite !== prev.isFavorite) return;
    
    if (current.createdAt && prev.createdAt) {
      await updateDoc(doc(db, 'users', user.uid, collectionName, current.id), { createdAt: prev.createdAt });
      await updateDoc(doc(db, 'users', user.uid, collectionName, prev.id), { createdAt: current.createdAt });
    }
  };

  const handleMoveDown = async (e, index) => {
    e.stopPropagation();
    if (index >= links.length - 1) return;
    const current = links[index];
    const next = links[index + 1];
    if (current.isFavorite !== next.isFavorite) return;
    
    if (current.createdAt && next.createdAt) {
      await updateDoc(doc(db, 'users', user.uid, collectionName, current.id), { createdAt: next.createdAt });
      await updateDoc(doc(db, 'users', user.uid, collectionName, next.id), { createdAt: current.createdAt });
    }
  };

  return (
    <div className="tab-pane">
      <button 
        type="button"
        className="toggle-form-btn" 
        onClick={() => setIsFormOpen(!isFormOpen)}
      >
        &gt; [ {isFormOpen ? '- close' : '+ add_new'} ]
      </button>

      <div className={`collapsible-form ${isFormOpen ? 'open' : ''}`}>
        <form className="input-group" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="meta-input"
        />
        <button type="submit" disabled={isSubmitting || !url || !nickname}>Save</button>
        </form>
      </div>

      <h2 className="tab-title">{title}</h2>

      <div className="list-container">
        {links.map((link, index) => {
          return (
          <React.Fragment key={link.id}>
            <div className="list-item">
            <div className="item-content" onClick={() => handleOpen(link.url)}>
              <img
                src={`https://s2.googleusercontent.com/s2/favicons?domain=${link.domain}&sz=32`}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                alt="favicon"
                className="favicon"
                style={{ width: '16px', height: '16px' }}
              />
              <Globe className="fallback-icon" size={14} style={{ display: 'none' }} />

              <div className="item-text-stack">
                <span className="item-text">
                  {index < 9 && <span style={{ opacity: 0.5, marginRight: '6px', fontSize: '0.9em' }}>[{index + 1}]</span>}
                  {link.nickname}
                </span>
                {link.description && <span className="item-desc">{link.description}</span>}
              </div>
            </div>

            <div className="item-actions">
              <div className="order-controls" style={{ display: 'flex', flexDirection: 'column', padding: '0 2px', gap: '0px' }}>
                <button
                  className="icon-btn"
                  onClick={(e) => handleMoveUp(e, index)}
                  disabled={index === 0 || link.isFavorite !== links[index - 1]?.isFavorite}
                  style={{ padding: '0px', border: 'none', height: '12px', lineHeight: 1 }}
                >
                  <ChevronUp size={12} opacity={(index === 0 || link.isFavorite !== links[index - 1]?.isFavorite) ? 0.3 : 0.8} />
                </button>
                <button
                  className="icon-btn"
                  onClick={(e) => handleMoveDown(e, index)}
                  disabled={index === links.length - 1 || link.isFavorite !== links[index + 1]?.isFavorite}
                  style={{ padding: '0px', border: 'none', height: '12px', lineHeight: 1 }}
                >
                  <ChevronDown size={12} opacity={(index === links.length - 1 || link.isFavorite !== links[index + 1]?.isFavorite) ? 0.3 : 0.8} />
                </button>
              </div>

              <button
                className={`icon-btn ${link.isFavorite ? 'favorited' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleFavorite(link.id, link.isFavorite); }}
              >
                <Star size={14} fill={link.isFavorite ? 'var(--color-accent)' : 'none'} />
              </button>

              <div className="menu-wrapper">
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === link.id ? null : link.id);
                  }}
                >
                  <MoreVertical size={14} />
                </button>
                {activeMenu === link.id && (
                  <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleOpen(link.url, true)}>
                      <ExternalLink size={14} /> New Window
                    </button>
                    <button onClick={() => requestEdit(link)}>
                      <Edit2 size={14} /> Edit
                    </button>
                    <button className="danger" onClick={() => requestDelete(link.id)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          </React.Fragment>
        )})}
      </div>

      {pendingDelete && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p>Delete completely?</p>
            <div className="modal-actions">
              <button onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p style={{marginBottom: "16px"}}>Edit Item</p>
            <form onSubmit={handleEditSave} className="input-group">
               <input 
                 type="text" 
                 value={editingItem.nickname} 
                 onChange={e => setEditingItem({...editingItem, nickname: e.target.value})}
               />
               <textarea 
                 value={editingItem.description}
                 onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                 rows={2}
                 className="meta-input"
                 placeholder="Description..."
               />
               <div className="modal-actions" style={{marginTop: "8px"}}>
                 <button type="button" onClick={() => setEditingItem(null)}>Cancel</button>
                 <button type="submit" className="btn-primary" disabled={!editingItem.nickname.trim()}>Save</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
