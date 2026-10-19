/// <reference path="../.astro/types.d.ts" />
import type { User } from './db/schema';

declare namespace App {
  interface Locals {
    /** 当前登录用户，未登录为 null；由 middleware 注入 */
    user: User | null;
  }
}
