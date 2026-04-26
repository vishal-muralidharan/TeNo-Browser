import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { ExternalLink, MoreVertical, Trash2, Globe, Star, Edit2, ChevronUp, ChevronDown } from 'lucide-react';

export default function LinkStorer({ collectionName = 'saved_links', title = 'Saved Links', isActive = true, user }) {
  const [url, setUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState('');
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
    const cleanLabel = label.trim().toLowerCase();
    await addDoc(collection(db, 'users', user.uid, collectionName), {
      url: cleanUrl,
      nickname: nickname.trim(),
      description: description.trim(),
      label: cleanLabel,
      domain: domain,
      isFavorite: false,
      createdAt: serverTimestamp()
    });
    setUrl('');
    setNickname('');
    setDescription('');
    setLabel('');
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
    setEditingItem({
      id: link.id,
      nickname: link.nickname,
      url: link.url,
      description: link.description || '',
      label: link.label || '',
    });
    setActiveMenu(null);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editingItem.nickname.trim() || !editingItem.url.trim()) return;

    let cleanUrl = editingItem.url.trim();
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

    const cleanLabel = editingItem.label.trim().toLowerCase();
    
    await updateDoc(doc(db, 'users', user.uid, collectionName, editingItem.id), {
       nickname: editingItem.nickname.trim(),
       url: cleanUrl,
       domain,
       description: editingItem.description.trim(),
       label: cleanLabel,
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

  const favoriteLinks = links.filter((link) => link.isFavorite);
  const otherLinks = links.filter((link) => !link.isFavorite);
  const otherGroupedLinks = otherLinks.reduce((groups, link) => {
    const groupName = link.label ? link.label.trim().toLowerCase() : '';
    const key = groupName || '__ungrouped__';
    if (!groups[key]) {
      groups[key] = { label: groupName, items: [] };
    }
    groups[key].items.push(link);
    return groups;
  }, {});

  const groupedOtherSections = Object.values(otherGroupedLinks).sort((a, b) => {
    if (a.label && b.label) return a.label.localeCompare(b.label);
    if (a.label) return -1;
    if (b.label) return 1;
    return 0;
  });

  const displaySections = [
    { key: 'favorites', title: 'favourites', items: favoriteLinks, favoriteGroup: true },
    ...groupedOtherSections.map((section) => ({
      key: section.label || '__ungrouped__',
      title: section.label || 'ungrouped',
      items: section.items,
      favoriteGroup: false,
    })),
  ];

  const flattenedDisplay = displaySections.flatMap((section) =>
    section.items.map((link) => ({
      link,
      sectionKey: section.key,
      favoriteGroup: section.favoriteGroup,
    }))
  );

  const findItemPosition = (itemId) => flattenedDisplay.findIndex((entry) => entry.link.id === itemId);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isActive) return;
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const keyIndex = parseInt(e.key) - 1;
      if (!isNaN(keyIndex) && keyIndex >= 0 && keyIndex < 9) {
        const entry = flattenedDisplay[keyIndex];
        if (entry) {
          handleOpen(entry.link.url);
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [flattenedDisplay, isActive]);

  const handleMoveWithinDisplay = async (e, currentIndex, direction) => {
    e.stopPropagation();
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= flattenedDisplay.length) return;

    const currentEntry = flattenedDisplay[currentIndex];
    const targetEntry = flattenedDisplay[targetIndex];
    if (currentEntry.sectionKey !== targetEntry.sectionKey) return;

    const current = currentEntry.link;
    const target = targetEntry.link;
    if (current.createdAt && target.createdAt) {
      await updateDoc(doc(db, 'users', user.uid, collectionName, current.id), { createdAt: target.createdAt });
      await updateDoc(doc(db, 'users', user.uid, collectionName, target.id), { createdAt: current.createdAt });
    }
  };

  const renderLinkCells = (sectionLinks, startIndex = 0, showLabelChip = true, sectionKey = '') => {
    if (sectionLinks.length === 0) {
      return <p className="section-empty">No items yet</p>;
    }

    return (
      <div className="list-container">
        {sectionLinks.map((link, localIndex) => {
          const index = startIndex + localIndex;
          const globalIndex = findItemPosition(link.id);
          const previousEntry = globalIndex > 0 ? flattenedDisplay[globalIndex - 1] : null;
          const nextEntry = globalIndex < flattenedDisplay.length - 1 ? flattenedDisplay[globalIndex + 1] : null;
          const canMoveUp = globalIndex > 0 && previousEntry && previousEntry.sectionKey === sectionKey;
          const canMoveDown = globalIndex < flattenedDisplay.length - 1 && nextEntry && nextEntry.sectionKey === sectionKey;
          return (
            <React.Fragment key={link.id}>
              <div className="list-item">
                <div className="item-content" onClick={() => handleOpen(link.url)}>
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain=${link.domain}&sz=64`}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    alt="favicon"
                    className="favicon"
                  />
                  <Globe className="fallback-icon" size={22} style={{ display: 'none' }} />

                  <div className="item-text-stack">
                    <span className="item-text">
                      {globalIndex < 9 && <span style={{ opacity: 0.5, marginRight: '6px', fontSize: '0.9em' }}>[{globalIndex + 1}]</span>}
                      {link.nickname}
                    </span>
                    {showLabelChip && link.label && <span className="label-chip">{link.label}</span>}
                    {link.description && <span className="item-desc">{link.description}</span>}
                  </div>
                </div>

                <div className="item-actions">
                  <div className="order-controls" style={{ display: 'flex', flexDirection: 'column', padding: '0 2px', gap: '0px' }}>
                    <button
                      className="icon-btn"
                      onClick={(e) => handleMoveWithinDisplay(e, globalIndex, -1)}
                      disabled={!canMoveUp}
                      style={{ padding: '0px', border: 'none', height: '12px', lineHeight: 1 }}
                    >
                      <ChevronUp size={12} opacity={canMoveUp ? 0.8 : 0.3} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={(e) => handleMoveWithinDisplay(e, globalIndex, 1)}
                      disabled={!canMoveDown}
                      style={{ padding: '0px', border: 'none', height: '12px', lineHeight: 1 }}
                    >
                      <ChevronDown size={12} opacity={canMoveDown ? 0.8 : 0.3} />
                    </button>
                  </div>

                  <button
                    className={`icon-btn ${link.isFavorite ? 'favorited' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(link.id, link.isFavorite); }}
                  >
                    <Star size={20} fill={link.isFavorite ? 'var(--color-accent)' : 'none'} />
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
          );
        })}
      </div>
    );
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
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
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

      <section className="section-block">
        <h3 className="section-title">favourites</h3>
        {renderLinkCells(favoriteLinks, 0, true, 'favorites')}
      </section>

      <section className="section-block">
        <h3 className="section-title">other links</h3>
        {groupedOtherSections.length === 0 ? (
          <p className="section-empty">No items yet</p>
        ) : (
          groupedOtherSections.map((section) => (
            <div key={section.label || 'ungrouped'} className="label-section">
              {section.label ? <h4 className="label-section-title">{section.label}</h4> : <h4 className="label-section-title">ungrouped</h4>}
              {renderLinkCells(section.items, 0, false, section.label || '__ungrouped__')}
            </div>
          ))
        )}
      </section>

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
                 placeholder="Nickname"
               />
               <input 
                 type="text" 
                 value={editingItem.url} 
                 onChange={e => setEditingItem({...editingItem, url: e.target.value})}
                 placeholder="URL"
               />
               <input 
                 type="text" 
                 value={editingItem.label} 
                 onChange={e => setEditingItem({...editingItem, label: e.target.value})}
                 placeholder="Label (optional)"
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
