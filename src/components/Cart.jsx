import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

function Cart({ user }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'cart_items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  const addItem = async (e) => {
    e.preventDefault();
    if (!url && !title) return;
    const cleanLabel = label.trim().toLowerCase();
    await addDoc(collection(db, 'users', user.uid, 'cart_items'), {
      title: title || url,
      url: url,
      label: cleanLabel,
      createdAt: new Date().toISOString()
    });
    setTitle('');
    setUrl('');
    setLabel('');
    setShowForm(false);
  };

  const groupedItems = items.reduce((groups, item) => {
    const groupName = item.label ? item.label.trim().toLowerCase() : '';
    const key = groupName || '__ungrouped__';
    if (!groups[key]) {
      groups[key] = { label: groupName, items: [] };
    }
    groups[key].items.push(item);
    return groups;
  }, {});

  const groupedSections = Object.values(groupedItems).sort((a, b) => {
    if (a.label && b.label) return a.label.localeCompare(b.label);
    if (a.label) return -1;
    if (b.label) return 1;
    return 0;
  });

  const removeItem = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'cart_items', id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h3>directory // cart</h3>
        <button className="toggle-add-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? '> [ collapse_form ]' : '> [ + add_new ]'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addItem} style={{ maxWidth: '600px', margin: '0 auto 30px', padding: '20px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <input 
            type="text" 
            placeholder="item name" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="mono-input"
          />
          <input 
            type="url" 
            placeholder="store link (optional)" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            className="mono-input"
          />
          <input 
            type="text" 
            placeholder="label (optional)" 
            value={label} 
            onChange={(e) => setLabel(e.target.value)} 
            className="mono-input"
          />
          <button type="submit" className="submit-btn" style={{ width: '100%' }}>add_to_cart</button>
        </form>
      )}

      {items.length === 0 ? <div style={{ color: 'var(--text-secondary)' }}>cart is empty.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {groupedSections.map((section) => (
            <div key={section.label || 'ungrouped'} className="section-block">
              <h3 className="section-title">{section.label || 'ungrouped'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {section.items.map((item) => (
                  <div key={item.id} className="item-row">
                    <div className="info-col">
                      <span style={{ fontWeight: 'bold' }}>{item.title}</span>
                      {item.label && <span className="label-chip">{item.label}</span>}
                      {item.url && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.url}</span>}
                    </div>
                    <div className="action-col">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="action-icon" title="open link">
                          [ view ]
                        </a>
                      )}
                      <button onClick={() => removeItem(item.id)} className="action-icon" title="remove" style={{ color: 'var(--accent)' }}>
                        [ drop ]
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Cart;