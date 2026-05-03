const fs = require('fs');
let content = fs.readFileSync('src/components/LinkStorer.jsx', 'utf-8');

content = content.replace(
  /} from 'firebase\/firestore';/,
  ', setDoc } from \'firebase/firestore\';'
);

const stateRegex = /const \[isFormOpen, setIsFormOpen\] = useState\(false\);\s*\/\/\s*Custom Modal State\s*const \[pendingDelete, setPendingDelete\] = useState\(null\);\s*const \[editingItem, setEditingItem\] = useState\(null\);/;

const addStates = `const [isFormOpen, setIsFormOpen] = useState(false);

  // Custom Modal State
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  
  const [labelOrder, setLabelOrder] = useState([]);

  const handleMoveSection = async (sectionLabel, direction) => {
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

    const settingsDocRef = doc(db, 'users', user.uid, 'settings', `labels_${collectionName}`);
    await setDoc(settingsDocRef, { order: newLabels }, { merge: true });
  };`;

content = content.replace(stateRegex, addStates);

const effectRegex = /const q = query\(\s*collection\(db, 'users', user\.uid, collectionName\)\s*\);/;

const addListener = `
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', \`labels_${collectionName}\`);
    const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setLabelOrder(docSnap.data().order || []);
      } else {
        setLabelOrder([]);
      }
    });

    const q = query(
      collection(db, 'users', user.uid, collectionName)
    );`;
content = content.replace(effectRegex, addListener);

content = content.replace(
  /unsub\(\);\s*if \(storageListener && typeof chrome !== 'undefined' && chrome\.storage && chrome\.storage\.onChanged\) {/, 
  `unsub();
      unsubSettings();
      if (storageListener && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {`
);

const sortRegex = /\.sort\(\(a, b\) => {\s*if \(a\.key === 'favorites'\) return -1;\s*if \(b\.key === 'favorites'\) return 1;\s*if \(a\.key === 'ungrouped'\) return 1;\s*if \(b\.key === 'ungrouped'\) return -1;\s*return a\.label\.localeCompare\(b\.label\);\s*}\);/;

const newSort = `.sort((a, b) => {
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
    });`;
content = content.replace(sortRegex, newSort);

const renderRegex = /<h3 className="section-title">\{section\.title\}<\/h3>/;

const newRender = `<h3 className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{section.title}</span>
            {section.key !== 'favorites' && section.key !== 'ungrouped' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="icon-btn" 
                  onClick={() => handleMoveSection(section.label, -1)}
                  style={{ padding: '0px', height: '16px', border: 'none', background: 'transparent' }}
                  title="Move up"
                >
                  <ChevronUp size={16} />
                </button>
                <button 
                  className="icon-btn" 
                  onClick={() => handleMoveSection(section.label, 1)}
                  style={{ padding: '0px', height: '16px', border: 'none', background: 'transparent' }}
                  title="Move down"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
          </h3>`;

content = content.replace(renderRegex, newRender);

fs.writeFileSync('src/components/LinkStorer.jsx', content);
console.log('Successfully updated LinkStorer.jsx');