import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWindow } from './components/ChatWindow/ChatWindow';

const root = createRoot(document.getElementById('root')!);
root.render(<ChatWindow />);
