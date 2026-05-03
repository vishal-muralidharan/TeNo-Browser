import { ChevronUp, ChevronDown } from 'lucide-react'

export default function Timer({
  timerState = 'idle',
  timerDisplayMs = 0,
  timerInputMinutes = 0,
  setTimerInputMinutes = () => {},
  handleTimerStart = () => {},
  handleTimerPause = () => {},
  handleTimerStop = () => {},
}) {
  const incrementMin = () => setTimerInputMinutes(Math.min(999, Number(timerInputMinutes) + 1))
  const decrementMin = () => setTimerInputMinutes(Math.max(0, Number(timerInputMinutes) - 1))

  const renderDigitalClock = (ms) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    const millis = Math.floor((ms % 1000) / 10)

    return (
      <div className="digital-clock">
        <span>
          {hrs.toString().padStart(2, '0')}:
          {mins.toString().padStart(2, '0')}:
          {secs.toString().padStart(2, '0')}
        </span>
        <sub>{millis.toString().padStart(2, '0')}</sub>
      </div>
    )
  }

  return (
    <div className="tab-pane timer-tab">
      <div className="timer-card">
        {renderDigitalClock(timerDisplayMs)}
      </div>

      <div className="timer-action-area">
        {timerState === 'idle' && (
          <div className="timer-setup">
            <div className="custom-number-input">
              <button type="button" className="arrow-btn" onClick={decrementMin}><ChevronDown size={18} /></button>
              <div className="typing-caret-field typing-caret-field--centered custom-number-input-field" data-empty={Number(timerInputMinutes) === 0}>
                <input
                  type="number"
                  value={Math.max(timerInputMinutes, 0)}
                  onChange={(event) => setTimerInputMinutes(parseInt(event.target.value, 10) || 0)}
                />
              </div>
              <button type="button" className="arrow-btn" onClick={incrementMin}><ChevronUp size={18} /></button>
            </div>
            <span className="min-label">minutes</span>
          </div>
        )}

        <div className="timer-controls">
          {timerState === 'running' ? (
            <>
              <button className="btn-primary" onClick={handleTimerPause}>Pause</button>
              <button className="btn-primary danger" onClick={handleTimerStop}>Stop</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={handleTimerStart}>Start</button>
              <button className="btn-primary danger" onClick={handleTimerStop}>Reset</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
