import { useState, useEffect, useRef } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import CryptoJS from 'crypto-js';
import { db, cleanupOldMessages, type Message } from '../lib/db';

const HEROES = ['Iron Knight', 'Shadow Bat', 'Steel Flash', 'Mystic Witch', 'Aqua Guard', 'Storm Rider'];

export const useChat = (password: string) => {
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myHero, setMyHero] = useState('');
  const [peerHero, setPeerHero] = useState('Waiting...');
  const peerRef = useRef<Peer | null>(null);

  const roomId = password ? CryptoJS.SHA256(password).toString().substring(0, 12) : '';

  useEffect(() => {
    if (!roomId) return;
    cleanupOldMessages(); //
    db.messages.where('roomId').equals(roomId).sortBy('timestamp').then(setMessages); //
    
    db.profiles.get('me').then(p => {
      const name = p?.name || HEROES[Math.floor(Math.random() * HEROES.length)];
      setMyHero(name);
      if(!p) db.profiles.add({id: 'me', name});
    });
  }, [roomId]);

  const killChat = async () => {
    if (!roomId) return;
    await db.messages.where('roomId').equals(roomId).delete();
    setMessages([]);
    if (conn?.open) conn.send({ type: 'kill-signal' });
    localStorage.removeItem('chat_p_pass');
    window.location.reload();
  };

  useEffect(() => {
    if (!password || !roomId) return;
    const idA = `room-${roomId}-A`;
    const idB = `room-${roomId}-B`;

    const initPeer = (id: string, isSecondary: boolean) => {
      const delay = isSecondary ? 1000 : 0;
      setTimeout(() => {
        const peer = new Peer(id, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });
        peerRef.current = peer;

        peer.on('open', (currentId) => {
          const target = currentId.endsWith('-A') ? idB : idA;
          const interval = setInterval(() => {
            if (!isOnline && peerRef.current && !peerRef.current.destroyed) {
              const c = peerRef.current.connect(target, { reliable: true });
              setupConn(c);
            }
          }, 3000);
          return () => clearInterval(interval);
        });

        peer.on('connection', setupConn); //

        peer.on('error', (err) => {
          if ((err.type === 'unavailable-id') && !isSecondary) {
            peer.destroy();
            initPeer(idB, true); 
          }
        });
      }, delay);
    };

    function setupConn(c: DataConnection) {
      c.on('open', () => {
        setConn(c);
        setIsOnline(true);
        c.send({ type: 'name-sync', name: myHero });
      });

      c.on('data', async (data: any) => {
        if (data.type === 'name-sync') setPeerHero(data.name);
        if (data.type === 'kill-signal') {
          await db.messages.where('roomId').equals(roomId).delete();
          localStorage.removeItem('chat_p_pass');
          window.location.reload();
        }
        if (data.type === 'msg') {
          const newMsg: Message = { ...data.payload, roomId, sender: 'peer', status: 'read' }; //
          await db.messages.add(newMsg);
          setMessages(prev => [...prev, newMsg]);
          c.send({ type: 'read-receipt', id: data.payload.id });
        }
        if (data.type === 'read-receipt') {
          setMessages(prev => prev.map(m => m.id === data.id ? { ...m, status: 'read' } : m));
          db.messages.update(data.id, { status: 'read' });
        }
      });
      c.on('close', () => setIsOnline(false));
    }

    initPeer(idA, false);
    return () => peerRef.current?.destroy();
  }, [password, myHero, roomId]);

  const sendMessage = async (content: string) => {
    if (!conn?.open || !roomId) return;
    const msg: Message = { id: crypto.randomUUID(), roomId, content, timestamp: Date.now(), sender: 'me', status: 'sent' };
    conn.send({ type: 'msg', payload: msg });
    await db.messages.add(msg); //
    setMessages(prev => [...prev, msg]);
  };

  return { isOnline, messages, sendMessage, peerHero, myHero, killChat };
};