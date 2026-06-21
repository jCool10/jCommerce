import { All, Controller, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ProxyService } from './proxy.service.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import type { RequestWithId } from '../correlation/correlation.middleware.js';
import {
  THROTTLE_LIMIT_BROWSE,
  THROTTLE_LIMIT_CHECKOUT,
  THROTTLE_LIMIT_LOGIN,
} from './throttler-limits.js';

type GatewayRequest = AuthenticatedRequest & RequestWithId;

/**
 * Routes are declared bottom-up by specificity so NestJS's longest-match wins:
 * narrow paths (`auth/login`, `checkout`) carry their own @Throttle decorator,
 * the rest fall back to the global throttler limit. Every method body is the
 * same call — ProxyService figures out the downstream from the URL.
 */
@Controller({ version: '1' })
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('auth/login')
  @Throttle(THROTTLE_LIMIT_LOGIN)
  async authLogin(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('auth/refresh')
  @Throttle(THROTTLE_LIMIT_LOGIN)
  async authRefresh(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('auth/*')
  async auth(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('checkout')
  @Throttle(THROTTLE_LIMIT_CHECKOUT)
  async checkout(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('cart')
  async cartRoot(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('cart/*')
  async cart(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('orders')
  async ordersRoot(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('orders/*')
  async orders(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('catalog')
  @Throttle(THROTTLE_LIMIT_BROWSE)
  async catalogRoot(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('catalog/*')
  @Throttle(THROTTLE_LIMIT_BROWSE)
  async catalog(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('products/*')
  @Throttle(THROTTLE_LIMIT_BROWSE)
  async products(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('products')
  @Throttle(THROTTLE_LIMIT_BROWSE)
  async productsRoot(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('search/*')
  @Throttle(THROTTLE_LIMIT_BROWSE)
  async searchTree(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }

  @All('search')
  @Throttle(THROTTLE_LIMIT_BROWSE)
  async searchRoot(@Req() req: GatewayRequest, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }
}
