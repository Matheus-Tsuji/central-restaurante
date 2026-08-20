import { Bonjour } from 'bonjour-service';
import os from 'node:os';

let instance: Bonjour | null = null;

export function initMDNS(frontendPort = 5173, backendPort = 3000): void {
  try {
    instance = new Bonjour();

    // Publica o serviço mDNS para o nome restaurante.local na rede Wi-Fi local
    instance.publish({
      name: 'restaurante',
      type: 'http',
      port: frontendPort,
      host: 'restaurante.local'
    });

    instance.publish({
      name: 'restaurante-api',
      type: 'http',
      port: backendPort,
      host: 'restaurante.local'
    });

    console.log('🌐 Servidor DNS Local (mDNS / Bonjour ZeroConf) Ativado:');
    console.log(`   📱 Garçons / Celulares podem acessar via: http://restaurante.local:${frontendPort}`);
    console.log(`   ⚙️ API / Backend acessível via: http://restaurante.local:${backendPort}`);
  } catch (err) {
    console.warn('⚠️ Não foi possível registrar o serviço mDNS no sistema:', err);
  }
}

export function stopMDNS(): void {
  if (instance) {
    instance.destroy();
  }
}
