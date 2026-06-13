import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../domain/app-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly settings: Repository<AppSettingEntity>,
  ) {}

  async getPublicSettings() {
    const rows = await this.settings.find();
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    return {
      backgroundUrl: byKey.get('backgroundUrl') ?? '',
      companyName: byKey.get('companyName') ?? 'Orion Shop',
      logoUrl: byKey.get('logoUrl') ?? '',
    };
  }

  async getPointsRate() {
    const rows = await this.settings.findBy([{ key: 'pointsRatePesos' }, { key: 'cashbackPesos' }]);
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const pesosPerPoint = Math.max(1, Number(byKey.get('pointsRatePesos') || 1000));
    const cashbackPesos = Math.max(0, Number(byKey.get('cashbackPesos') || 1));
    return { pesosPerPoint, cashbackPesos };
  }

  async setBackground(backgroundUrl: string) {
    await this.settings.save({ key: 'backgroundUrl', value: backgroundUrl });
    return this.getPublicSettings();
  }

  async setBrand(companyName: string, logoUrl?: string | null) {
    await this.settings.save({ key: 'companyName', value: companyName });
    if (logoUrl !== undefined && logoUrl !== null) {
      await this.settings.save({ key: 'logoUrl', value: logoUrl });
    }
    return this.getPublicSettings();
  }

  async setPointsRate(pesosPerPoint: number, cashbackPesos: number) {
    await this.settings.save({ key: 'pointsRatePesos', value: String(pesosPerPoint) });
    await this.settings.save({ key: 'cashbackPesos', value: String(cashbackPesos) });
    return this.getPointsRate();
  }
}
