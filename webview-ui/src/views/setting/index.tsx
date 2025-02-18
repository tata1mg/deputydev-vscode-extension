import { useState } from 'react';
import {
  setGlobalState,
  getGlobalState,
  deleteGlobalState,
} from '../../commandApi';
import { Button } from "@/components/ui/button";

export default function Setting() {
  const [state, setState] = useState(null);
  const key = 'testKey'; // Example key

  const handleSetState = () => {
    setGlobalState({ key, value: 'Hello, VSCode!' });
  };

  const handleGetState = async () => {
    const value = await getGlobalState({ key });
    setState(value);
  };

  const handleDeleteState = () => {
    deleteGlobalState({ key });
    setState(null);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Settings</h2>
      <Button onClick={handleSetState}>Set Global State</Button>
      <Button onClick={handleGetState}>Get Global State</Button>
      <Button onClick={handleDeleteState}>Delete Global State</Button>
      <div className="mt-4">
        <strong>Stored Value:</strong> {state !== null ? state : 'No value set'}
      </div>
    </div>
  );
}
