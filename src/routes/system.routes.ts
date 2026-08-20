import { Router } from 'express';
import { getLocalIpAddress } from '../utils/networkUtils.js';
import { getConnectedDevices } from '../sockets/socketManager.js';

const router = Router();

router.get('/info', (req, res) => {
  const localIp = getLocalIpAddress();
  const frontendUrl = `http://${localIp}:5173`;
  const backendUrl = `http://${localIp}:3000`;
  const connectedDevices = getConnectedDevices();

  res.json({
    local_ip: localIp,
    frontend_url: frontendUrl,
    backend_url: backendUrl,
    connected_devices: connectedDevices,
    total_connected: connectedDevices.length
  });
});

export default router;
