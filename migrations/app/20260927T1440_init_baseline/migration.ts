#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8f41ea2a97dd361c0694a52f21ebe5f416d0d7c33bd0ad2c342f1a1ca41f213c/contract';
import endContract from '../../snapshots/8f41ea2a97dd361c0694a52f21ebe5f416d0d7c33bd0ad2c342f1a1ca41f213c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
