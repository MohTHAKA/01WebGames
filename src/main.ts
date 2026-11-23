import './learn-play/learn-play.css';
import { LearnPlayApp } from './learn-play/app.ts';

// Phase 1: catalog and navigation only. PlayCanvas is loaded lazily by the mission page in Phase 2.
new LearnPlayApp(document.getElementById('app') as HTMLElement);
