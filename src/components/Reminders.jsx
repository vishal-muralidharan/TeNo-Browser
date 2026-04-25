import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Edit2, ChevronUp, ChevronDown } from 'lucide-react';

export default function Reminders({ user }) {
  const [text, setText] = useState('');
  const [reminders, setReminders] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Modal State
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'reminders')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      data.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeA - timeB; // Ascending logic as requested for LinkStorer apply here? Or descending? Original was desc. Let's do descending: timeA - timeB -> ascending, wait. Original was desc, let's keep desc: timeB - timeA.
      });
      data.sort((a,b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
         return timeB - timeA;
      });
      setReminders(data);
    });
    return unsub;
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user) return;

    setIsSubmitting(true);
    await addDoc(collection(db, 'users', user.uid, 'reminders'), {
      text: text.trim(),
      createdAt: serverTimestamp()
    });
    setText('');
    setIsSubmitting(false);
  };

  const handleComplete = (id) => {
    setPendingDelete(id);
  };

  const confirmComplete = async () => {
    if (pendingDelete) {
      await deleteDoc(doc(db, 'users', user.uid, 'reminders', pendingDelete));
      setPendingDelete(null);
    }
  };

  const requestEdit = (r) => {
    setEditingReminder({ id: r.id, text: r.text });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editingReminder.text.trim()) return;
    await updateDoc(doc(db, 'users', user.uid, 'reminders', editingReminder.id), { text: editingReminder.text.trim() });
    setEditingReminder(null);
  };

  const handleMoveUp = async (e, index) => {
    e.stopPropagation();
    if (index <= 0) return;
    const current = reminders[index];
    const prev = reminders[index - 1];
    
    if (current.createdAt && prev.createdAt) {
      await updateDoc(doc(db, 'users', user.uid, 'reminders', current.id), { createdAt: prev.createdAt });
      await updateDoc(doc(db, 'users', user.uid, 'reminders', prev.id), { createdAt: current.createdAt });
    }
  };

  const handleMoveDown = async (e, index) => {
    e.stopPropagation();
    if (index >= reminders.length - 1) return;
    const current = reminders[index];
    const next = reminders[index + 1];
    
    if (current.createdAt && next.createdAt) {
      await updateDoc(doc(db, 'users', user.uid, 'reminders', current.id), { createdAt: next.createdAt });
      await updateDoc(doc(db, 'users', user.uid, 'reminders', next.id), { createdAt: current.createdAt });
    }
  };

  return (
    <div className="tab-pane">
      <form className="input-group" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add new reminder here"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={isSubmitting || !text.trim()}>Add</button>
      </form>

      <h2 className="tab-title">Reminders</h2>

      <div className="list-container">
        {reminders.map((r, index) => (
          <div key={r.id} className="list-item reminder-item">
            <div className="item-content" style={{gap: '16px'}}>
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleComplete(r.id)}
                />
                <span className="checkmark"></span>
              </label>
              <span className="item-text" style={{whiteSpace: 'normal', wordBreak: 'break-word'}}>{r.text}</span>
            </div>
            <div className="item-actions">
              <div className="order-controls" style={{ display: 'flex', flexDirection: 'column', padding: '0 4px', gap: '2px' }}>
                <button
                  className="icon-btn"
                  onClick={(e) => handleMoveUp(e, index)}
                  disabled={index === 0}
                  style={{ padding: '0px', border: 'none', height: '14px', lineHeight: 1 }}
                >
                  <ChevronUp size={14} opacity={index === 0 ? 0.3 : 0.8} />
                </button>
                <button
                  className="icon-btn"
                  onClick={(e) => handleMoveDown(e, index)}
                  disabled={index === reminders.length - 1}
                  style={{ padding: '0px', border: 'none', height: '14px', lineHeight: 1 }}
                >
                  <ChevronDown size={14} opacity={index === reminders.length - 1 ? 0.3 : 0.8} />
                </button>
              </div>
              <button className="icon-btn" onClick={() => requestEdit(r)}>
                <Edit2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingDelete && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p>Mark Reminder as Complete?</p>
            <div className="modal-actions">
              <button onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmComplete}>Complete</button>
            </div>
          </div>
        </div>
      )}

      {editingReminder && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p style={{marginBottom: "16px"}}>Edit Reminder</p>
            <form onSubmit={handleEditSave} className="input-group">
               <input 
                 type="text" 
                 value={editingReminder.text} 
                 onChange={e => setEditingReminder({...editingReminder, text: e.target.value})}
               />
               <div className="modal-actions" style={{marginTop: "8px"}}>
                 <button type="button" onClick={() => setEditingReminder(null)}>Cancel</button>
                 <button type="submit" className="btn-primary" disabled={!editingReminder.text.trim()}>Save</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
