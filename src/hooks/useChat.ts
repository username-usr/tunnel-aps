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
    cleanupOldMessages();
    db.messages.where('roomId').equals(roomId).sortBy('timestamp').then(setMessages);
    
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
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
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

        peer.on('connection', setupConn);

        peer.on('error', (err) => {
          if ((err.type === 'unavailable-id') && !isSecondary) {
            peer.destroy();
            initPeer(idB, true); 
          }
        });
      }, delay);
    };

    async function setupConn(c: DataConnection) {
      c.on('open', async () => {
        setConn(c);
        setIsOnline(true);
        c.send({ type: 'name-sync', name: myHero });

        // Phase 1: Send my local history to peer
        const myLocalHistory = await db.messages.where('roomId').equals(roomId).toArray();
        c.send({ type: 'history-sync', payload: myLocalHistory });
      });

      c.on('data', async (data: any) => {
        if (data.type === 'name-sync') setPeerHero(data.name);
        
        if (data.type === 'kill-signal') {
          await db.messages.where('roomId').equals(roomId).delete();
          localStorage.removeItem('chat_p_pass');
          window.location.reload();
        }

        // Live Message Receipt
        if (data.type === 'msg') {
          const newMsg: Message = { ...data.payload, roomId, sender: 'peer', status: 'read' };
          const exists = await db.messages.get(newMsg.id);
          if (!exists) {
            await db.messages.add(newMsg);
            setMessages(prev => [...prev, newMsg]);
          }
          c.send({ type: 'read-receipt', id: data.payload.id });
        }

        // History Sync & Bulk Acknowledgment
        if (data.type === 'history-sync') {
          let receivedIds: string[] = [];
          for (const remoteMsg of data.payload) {
            const exists = await db.messages.get(remoteMsg.id);
            if (!exists) {
              await db.messages.add({ ...remoteMsg, sender: 'peer', status: 'read' });
            }
            // Always collect the ID to acknowledge we have it now
            if (remoteMsg.id) receivedIds.push(remoteMsg.id);
          }
          
          // Send back bulk receipt so the other person sees double ticks
          if (receivedIds.length > 0) {
            c.send({ type: 'bulk-read-receipt', ids: receivedIds });
          }
          
          db.messages.where('roomId').equals(roomId).sortBy('timestamp').then(setMessages);
        }

        // Handle Read Receipts (Single & Bulk)
        if (data.type === 'read-receipt' || data.type === 'bulk-read-receipt') {
          const idsToUpdate = data.type === 'bulk-read-receipt' ? data.ids : [data.id];
          
          for (const id of idsToUpdate) {
            await db.messages.update(id, { status: 'read' });
          }
          
          setMessages(prev => prev.map(m => 
            idsToUpdate.includes(m.id) ? { ...m, status: 'read' } : m
          ));
        }
      });

      c.on('close', () => setIsOnline(false));
    }

    initPeer(idA, false);
    return () => peerRef.current?.destroy();
  }, [password, myHero, roomId]);

  const sendMessage = async (content: string) => {
    if (!roomId) return;
    const msg: Message = { 
      id: crypto.randomUUID(), 
      roomId, 
      content, 
      timestamp: Date.now(), 
      sender: 'me', 
      status: 'sent' 
    };

    await db.messages.add(msg);
    setMessages(prev => [...prev, msg]);

    if (conn?.open) {
      conn.send({ type: 'msg', payload: msg });
    }
  };

  return { isOnline, messages, sendMessage, peerHero, myHero, killChat };
};