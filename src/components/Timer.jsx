import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function Timer() {
  const [timerState, setTimerState] = useState('idle'); // idle, running, paused
  const [timerMode, setTimerMode] = useState('stopwatch'); // stopwatch, countdown
  const [startTime, setStartTime] = useState(null);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [targetDuration, setTargetDuration] = useState(0);
  
  const [inputMinutes, setInputMinutes] = useState(0);
  const [displayMs, setDisplayMs] = useState(0);

  // Sync from chrome storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(
        ['timerState', 'timerMode', 'startTime', 'accumulatedMs', 'targetDuration'], 
        (res) => {
          if (res.timerState) setTimerState(res.timerState);
          if (res.timerMode) setTimerMode(res.timerMode);
          if (res.startTime) setStartTime(res.startTime);
          if (res.accumulatedMs !== undefined) setAccumulatedMs(res.accumulatedMs);
          if (res.targetDuration) setTargetDuration(res.targetDuration);
        }
      );
    }
  }, []);

  const saveToStorage = (updates) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set(updates);
    }
  };

  useEffect(() => {
    const updateTimes = () => {
      const now = Date.now();
      
      let calcAccumulated = accumulatedMs;
      if (timerState === 'running' && startTime) {
         calcAccumulated += (now - startTime);
      }
      
      let mode = timerMode;
      if (timerState === 'idle') {
        const mins = Number(inputMinutes);
        if (mins > 0) mode = 'countdown';
      }

      if (mode === 'countdown') {
         let duration = targetDuration;
         if (timerState === 'idle') {
            duration = Number(inputMinutes) * 60 * 1000;
         }
         const remaining = duration - calcAccumulated;
         if (remaining <= 0 && timerState === 'running') {
            setDisplayMs(0);
            setTimerState('idle');
            setAccumulatedMs(0);
            setStartTime(null);
            saveToStorage({ timerState: 'idle', accumulatedMs: 0, startTime: null });
         } else {
            setDisplayMs(Math.max(0, remaining));
         }
      } else {
         // stopwatch
         setDisplayMs(calcAccumulated);
      }
    };

    updateTimes(); 
    const interval = setInterval(updateTimes, 40);
    return () => clearInterval(interval);
  }, [timerState, timerMode, startTime, accumulatedMs, targetDuration, inputMinutes]);

  const handleStart = () => {
    const now = Date.now();
    let mode = timerMode;
    let duration = targetDuration;

    if (timerState === 'idle') {
      const mins = Number(inputMinutes);
      if (mins > 0) {
        mode = 'countdown';
        duration = mins * 60 * 1000;
      } else {
        mode = 'stopwatch';
        duration = 0;
      }
      setTimerMode(mode);
      setTargetDuration(duration);
      setAccumulatedMs(0);
      setInputMinutes(0); // clear input visual on run
    }

    setTimerState('running');
    setStartTime(now);
    
    const updates = { 
       timerState: 'running', 
       startTime: now, 
       timerMode: mode, 
       targetDuration: duration 
    };
    if (timerState === 'idle') updates.accumulatedMs = 0;
    saveToStorage(updates);

    if (typeof chrome !== 'undefined' && chrome.alarms) {
       if (mode === 'countdown') {
          const remaining = duration - (timerState === 'idle' ? 0 : accumulatedMs);
          chrome.alarms.create('countdown_alarm', { when: now + remaining });
       }
    }
  };

  const handlePause = () => {
    const now = Date.now();
    const elapsed = now - startTime;
    const newAccumulated = accumulatedMs + elapsed;
    
    setAccumulatedMs(newAccumulated);
    setTimerState('paused');
    setStartTime(null);
    
    saveToStorage({ timerState: 'paused', accumulatedMs: newAccumulated, startTime: null });
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear('countdown_alarm');
    }
  };

  const handleStopReset = () => {
    setTimerState('idle');
    setAccumulatedMs(0);
    setStartTime(null);
    setTargetDuration(0);
    setInputMinutes(0); 
    
    saveToStorage({ timerState: 'idle', accumulatedMs: 0, startTime: null, targetDuration: 0 });
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear('countdown_alarm');
    }
  };

  const incrementMin = () => setInputMinutes(Math.min(999, Number(inputMinutes) + 1));
  const decrementMin = () => setInputMinutes(Math.max(0, Number(inputMinutes) - 1));

  const renderDigitalClock = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10); 
    
    return (
      <div className="digital-clock">
        <span>
          {hrs.toString().padStart(2, '0')}:
          {mins.toString().padStart(2, '0')}:
          {secs.toString().padStart(2, '0')}
        </span>
        <sub>{millis.toString().padStart(2, '0')}</sub>
      </div>
    );
  };

  return (
    <div className="tab-pane timer-tab">
      <div className="timer-card">
        {renderDigitalClock(displayMs)}
      </div>

      <div className="timer-action-area">
        {timerState === 'idle' && (
          <div className="timer-setup">
            <div className="custom-number-input">
              <button className="arrow-btn" onClick={decrementMin}><ChevronDown size={18} /></button>
              <input 
                type="number" 
                value={Math.max(inputMinutes, 0)} 
                onChange={e => setInputMinutes(parseInt(e.target.value) || 0)}
              />
              <button className="arrow-btn" onClick={incrementMin}><ChevronUp size={18} /></button>
            </div>
            <span className="min-label">minutes</span>
          </div>
        )}
        
        <div className="timer-controls">
          {timerState === 'running' ? (
            <>
              <button className="btn-primary" onClick={handlePause}>Pause</button>
              <button className="btn-primary danger" onClick={handleStopReset}>Stop</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={handleStart}>Start</button>
              <button className="btn-primary danger" onClick={handleStopReset}>Reset</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
