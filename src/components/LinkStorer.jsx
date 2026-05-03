import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, where, setDoc } from 'firebase/firestore';
import { ExternalLink, MoreVertical, Trash2, Globe, Star, Edit2, ChevronUp, ChevronDown } from 'lucide-react';

export default function LinkStorer({ collectionName = 'saved_links', title = 'Saved Links', isActive = true, user, openFormSignal, terminalVisible = false, terminalHeight = 0, favoritesRowCount = 2, onLinkOpen }) {
  const [url, setUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState('');
  const [links, setLinks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeMenuDirection, setActiveMenuDirection] = useState('down');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Custom Modal State
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  
  const [labelOrder, setLabelOrder] = useState([]);
  const lastOpenSignal = useRef(openFormSignal);
  const nicknameInputRef = useRef(null);

  const handleMoveSection = async (e, sectionLabel, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentLabels = displaySections
      .filter(s => s.key !== 'favorites' && s.key !== 'ungrouped')
      .map(s => s.label);

    const oldIndex = currentLabels.indexOf(sectionLabel);
    if (oldIndex === -1) return;

    const newIndex = oldIndex + direction;
    if (newIndex < 0 || newIndex >= currentLabels.length) return;

    const newLabels = [...currentLabels];
    const temp = newLabels[newIndex];
    newLabels[newIndex] = newLabels[oldIndex];
    newLabels[oldIndex] = temp;

    console.log("Moving label", sectionLabel, "Direction:", direction);
    console.log("Old array:", currentLabels);
    console.log("New array:", newLabels);

    try {
      // Optimistically update local state so UI updates instantly
      setLabelOrder(newLabels);
      const settingsDocRef = doc(db, 'users', user.uid, 'settings', `labels_${collectionName}`);
      await setDoc(settingsDocRef, { order: newLabels }, { merge: true });
    } catch (err) {
      console.error("Error updating label order:", err);
      // Revert optimism if needed (won't bother for visual feedback alert test)
      alert("Failed to reorder: " + err.message);
    }
  };

  useEffect(() => {
    if (!user) return;

    const settingsDocRef = doc(db, 'users', user.uid, 'settings', `labels_${collectionName}`);
    const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setLabelOrder(docSnap.data().order || []);
      } else {
        setLabelOrder([]);
      }
    });

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
      unsubSettings();
      if (storageListener && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, [collectionName, user]);

  useEffect(() => {
    if (openFormSignal === undefined) return;
    if (lastOpenSignal.current !== openFormSignal) {
      setIsFormOpen(true);
      lastOpenSignal.current = openFormSignal;
    }
  }, [openFormSignal]);

  useEffect(() => {
    if (!isFormOpen) return;

    const focusTimer = setTimeout(() => {
      nicknameInputRef.current?.focus();
    }, 0);

    return () => clearTimeout(focusTimer);
  }, [isFormOpen]);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
      setActiveMenuDirection('down');
    };
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

  const handleOpen = (e, link, newWindow = false) => {
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }

    void onLinkOpen?.({ collectionName, link });

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      if (newWindow) {
        chrome.windows.create({ url: link.url });
      } else {
        chrome.tabs.create({ url: link.url, active: false });
      }
    } else {
      // Fallback for non-extension environment (Vite Dev Server)
      const win = window.open(link.url, '_blank');
      if (win) {
        win.blur();
        window.focus();
        setTimeout(() => window.focus(), 10); // Attempt to steal focus back
      }
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

  const normalizeLabel = (value) => value.trim().toLowerCase();

  const groupedLinks = links.reduce((groups, link) => {
    const labelKey = link.label ? normalizeLabel(link.label) : '';
    const sectionKey = labelKey || (link.isFavorite ? 'favorites' : 'ungrouped');

    if (!groups[sectionKey]) {
      groups[sectionKey] = {
        key: sectionKey,
        label: labelKey,
        title: sectionKey === 'favorites' ? 'favourites' : sectionKey,
        items: [],
      };
    }

    groups[sectionKey].items.push(link);
    return groups;
  }, {});

  const displaySections = Object.values(groupedLinks)
    .map((section) => ({
      ...section,
      items: [...section.items].sort((a, b) => {
        if (section.key !== 'favorites') {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
        }

        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      }),
    }))
    .sort((a, b) => {
      if (a.key === 'favorites') return -1;
      if (b.key === 'favorites') return 1;
      if (a.key === 'ungrouped') return 1;
      if (b.key === 'ungrouped') return -1;
      
      const indexA = labelOrder.indexOf(a.label);
      const indexB = labelOrder.indexOf(b.label);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return a.label.localeCompare(b.label);
    });

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
          handleOpen(e, entry.link);
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

  const renderLinkCells = (sectionLinks, startIndex = 0, showLabelChip = true, sectionKey = '', gridClassName = '', gridStyle = {}) => {
    if (sectionLinks.length === 0) {
      return <p className="section-empty">No items yet</p>;
    }

    return (
      <div className={`list-container ${gridClassName}`.trim()} style={gridStyle}>
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
                <div className="item-content" onClick={(e) => handleOpen(e, link)}>
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
                        if (activeMenu === link.id) {
                          setActiveMenu(null);
                          setActiveMenuDirection('down');
                          return;
                        }

                        const triggerRect = e.currentTarget.getBoundingClientRect();
                        const availableBelow = window.innerHeight - triggerRect.bottom - (terminalVisible ? terminalHeight : 0);
                        const estimatedMenuHeight = 132;
                        setActiveMenuDirection(availableBelow < estimatedMenuHeight ? 'up' : 'down');
                        setActiveMenu(link.id);
                      }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {activeMenu === link.id && (
                      <div className={`dropdown-menu ${activeMenuDirection === 'up' ? 'dropdown-menu-up' : 'dropdown-menu-down'}`} onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => handleOpen(e, link, true)}>
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
        <div className="typing-caret-field" data-empty={!nickname}>
          <input
            ref={nicknameInputRef}
            type="text"
            placeholder="Add Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div className="typing-caret-field" data-empty={!url}>
          <input
            type="text"
            placeholder="Enter URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="typing-caret-field" data-empty={!label}>
          <input
            type="text"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="typing-caret-field" data-empty={!description}>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={1}
            className="meta-input"
          />
        </div>
        <button type="submit" disabled={isSubmitting || !url || !nickname}>Save</button>
        </form>
      </div>

      <h2 className="tab-title">{title}</h2>

      {displaySections.filter((section) => section.key === 'favorites').map((section) => (
        <section key={section.key} className="section-block favorites-section">
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{section.title}</span>
          </h3>
          {renderLinkCells(section.items, 0, true, section.key, 'favorites-grid', { '--favorites-row-count': favoritesRowCount })}
        </section>
      ))}

      <div className="label-sections-grid">
        {displaySections.filter((section) => section.key !== 'favorites' && section.key !== 'ungrouped').map((section) => {
          const customSections = displaySections.filter(s => s.key !== 'favorites' && s.key !== 'ungrouped');
          const sIndex = customSections.findIndex(s => s.key === section.key);
          const canSectionMoveUp = sIndex > 0;
          const canSectionMoveDown = sIndex !== -1 && sIndex < customSections.length - 1;

          return (
            <section key={section.key} className="section-block label-group-card">
              <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{section.title}</span>
                <div className="order-controls" style={{ display: 'flex', flexDirection: 'column', padding: '0 2px', gap: '0px' }}>
                  <button 
                    type="button"
                    className="icon-btn" 
                    onClick={(e) => handleMoveSection(e, section.label, -1)}
                    disabled={!canSectionMoveUp}
                    style={{ padding: '0px', border: 'none', height: '12px', lineHeight: 1 }}
                    title="Move section up"
                  >
                    <ChevronUp size={12} opacity={canSectionMoveUp ? 0.8 : 0.3} />
                  </button>
                  <button 
                    type="button"
                    className="icon-btn" 
                    onClick={(e) => handleMoveSection(e, section.label, 1)}
                    disabled={!canSectionMoveDown}
                    style={{ padding: '0px', border: 'none', height: '12px', lineHeight: 1 }}
                    title="Move section down"
                  >
                    <ChevronDown size={12} opacity={canSectionMoveDown ? 0.8 : 0.3} />
                  </button>
                </div>
              </h3>
              {renderLinkCells(section.items, 0, false, section.key, 'label-grid-three')}
            </section>
          )
        })}
      </div>

      {displaySections.filter((section) => section.key === 'ungrouped').map((section) => (
        <section key={section.key} className="section-block">
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{section.title}</span>
          </h3>
          <div className="label-section">
            {renderLinkCells(section.items, 0, false, section.key)}
          </div>
        </section>
      ))}

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
               <div className="typing-caret-field" data-empty={!editingItem.nickname}>
                 <input 
                   type="text" 
                   value={editingItem.nickname} 
                   onChange={e => setEditingItem({...editingItem, nickname: e.target.value})}
                   placeholder="Nickname"
                 />
               </div>
               <div className="typing-caret-field" data-empty={!editingItem.url}>
                 <input 
                   type="text" 
                   value={editingItem.url} 
                   onChange={e => setEditingItem({...editingItem, url: e.target.value})}
                   placeholder="URL"
                 />
               </div>
               <div className="typing-caret-field" data-empty={!editingItem.label}>
                 <input 
                   type="text" 
                   value={editingItem.label} 
                   onChange={e => setEditingItem({...editingItem, label: e.target.value})}
                   placeholder="Label"
                 />
               </div>
               <div className="typing-caret-field" data-empty={!editingItem.description}>
                 <textarea 
                   value={editingItem.description}
                   onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                   rows={2}
                   className="meta-input"
                   placeholder="Description"
                 />
               </div>
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
