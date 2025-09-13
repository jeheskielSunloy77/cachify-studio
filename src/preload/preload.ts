import { contextBridge } from 'electron';
import { rendererApi } from './api';

contextBridge.exposeInMainWorld('api', rendererApi);
