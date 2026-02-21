import { useEffect, useState } from 'react';
import { initDatabase, createNote, getNotesByCreationOrder } from './lib/database';
import { subscribeToNotes } from './lib/realtime';
import { push } from './lib/sync';
import type { RealtimeChannel } from '@supabase/supabase-js';
import './App.css';

function App() {
  const [status, setStatus] = useState('Initializing...');
  const [notes, setNotes] = useState<string[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize database
        await initDatabase();
        setStatus('Loading notes...');

        // Load existing notes
        const existingNotes = await getNotesByCreationOrder();
        setNotes(existingNotes.map((n) => n.id));
        setStatus(`Ready (${existingNotes.length} notes)`);

        // Subscribe to realtime changes
        const ch = await subscribeToNotes(
          (noteId, event) => {
            console.log(`Note ${event}: ${noteId}`);
            loadNotes();
          },
          (status) => {
            setStatus(`Realtime: ${status}`);
          },
        );
        setChannel(ch);
      } catch (error) {
        console.error('Initialization failed:', error);
        setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  const loadNotes = async () => {
    try {
      const existingNotes = await getNotesByCreationOrder();
      setNotes(existingNotes.map((n) => n.id));
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleCreateTestNote = async () => {
    try {
      setStatus('Creating test note...');
      const noteId = await createNote('Test Note', 'dark');
      console.log(`Created note: ${noteId}`);

      setStatus('Pushing to Supabase...');
      await push();

      await loadNotes();
      setStatus(`Ready (${notes.length + 1} notes)`);
    } catch (error) {
      console.error('Failed to create note:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="container">
      <h1>Noat Desktop</h1>

      <div className="status-panel">
        <p>
          <strong>Status:</strong> {status}
        </p>
        <p>
          <strong>Notes:</strong> {notes.length}
        </p>
      </div>

      <button onClick={handleCreateTestNote}>Create Test Note</button>

      {notes.length > 0 && (
        <div className="notes-list">
          <h3>Local Notes:</h3>
          <ul>
            {notes.map((id) => (
              <li key={id}>{id.substring(0, 8)}...</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

export default App;
