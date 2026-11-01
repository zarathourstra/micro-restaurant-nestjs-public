import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { DependenciesConfig } from './shared/config/interfaces/dependencies-config.interface';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Retrieve config service
  const configService = app.get(ConfigService);

  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  // Proxy endpoints
  const dependenciesConfig = configService.get<DependenciesConfig>('dependencies');
  app.use('/menu', createProxyMiddleware({
    target: `http://${dependenciesConfig.menu_service_url_with_port}`,
    changeOrigin: true,
  }));
  app.use('/kitchen', createProxyMiddleware({
    target: `http://${dependenciesConfig.kitchen_service_url_with_port}`,
    changeOrigin: true,
  }));
  app.use('/dining', createProxyMiddleware({
    target: `http://${dependenciesConfig.dining_service_url_with_port}`,
    changeOrigin: true,
  }));

  // dining-service's Socket.IO engine (group-membership push notifications) lives at the
  // origin root (/socket.io), not under /dining - a separate proxy rule is needed for it.
  // Mounted at the root (not app.use('/socket.io', ...)) with its own pathFilter instead:
  // Express strips the mount prefix from req.url before the middleware sees it, which would
  // forward dining-service a path with /socket.io already stripped off - Engine.IO on the
  // other end only recognizes requests at that exact path, so a stripped prefix 404s silently.
  const diningSocketProxy = createProxyMiddleware({
    target: `http://${dependenciesConfig.dining_service_url_with_port}`,
    changeOrigin: true,
    ws: true,
    pathFilter: '/socket.io',
  });
  app.use(diningSocketProxy);

  // Run the app
  const appPort = configService.get('app.port');
  await app.listen(appPort);

  // http-proxy-middleware needs the underlying HTTP server's 'upgrade' event wired manually
  // for the WebSocket handshake itself to go through - Nest's app.listen() doesn't do this.
  app.getHttpServer().on('upgrade', diningSocketProxy.upgrade);
}
bootstrap();
