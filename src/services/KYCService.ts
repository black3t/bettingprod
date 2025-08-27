import { query } from '../config/database';
import { logger } from '../utils/logger';

export enum KYCStatus {
  NONE = 'NONE',
  PARTIAL = 'PARTIAL',
  FULL = 'FULL'
}

interface KYCInfo {
  playerId: string;
  status: KYCStatus;
  verifiedAt?: Date;
  documents?: string[];
}

/**
 * KYC Service
 * Bible riga 691: "Wallet/limits/kyc/exclusions"
 */
export class KYCService {
  
  /**
   * Get KYC status for player
   */
  async getKYCStatus(playerId: string): Promise<KYCInfo> {
    const result = await query(
      'SELECT * FROM kyc_status WHERE player_id = $1',
      [playerId]
    );
    
    if (result.rows.length === 0) {
      // Default to NONE if no record
      return {
        playerId,
        status: KYCStatus.NONE
      };
    }
    
    const kyc = result.rows[0];
    return {
      playerId,
      status: kyc.status as KYCStatus,
      verifiedAt: kyc.verified_at ? new Date(kyc.verified_at) : undefined,
      documents: kyc.documents ? JSON.parse(kyc.documents) : []
    };
  }
  
  /**
   * Update KYC status
   */
  async updateKYCStatus(playerId: string, status: KYCStatus): Promise<void> {
    const existing = await query(
      'SELECT * FROM kyc_status WHERE player_id = $1',
      [playerId]
    );
    
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO kyc_status (player_id, status, verified_at)
         VALUES ($1, $2, $3)`,
        [playerId, status, status === KYCStatus.FULL ? new Date() : null]
      );
    } else {
      await query(
        `UPDATE kyc_status 
         SET status = $2, verified_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE player_id = $1`,
        [playerId, status, status === KYCStatus.FULL ? new Date() : null]
      );
    }
    
    logger.info('KYC status updated', {
      playerId,
      status
    });
  }
  
  /**
   * Check if operation allowed based on KYC
   */
  async checkKYCLimits(playerId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    const kyc = await this.getKYCStatus(playerId);
    
    // Define limits based on KYC status
    const limits = {
      [KYCStatus.NONE]: 100,     // 100 EUR max without KYC
      [KYCStatus.PARTIAL]: 1000,  // 1000 EUR with partial KYC
      [KYCStatus.FULL]: 10000     // 10000 EUR with full KYC
    };
    
    const maxAmount = limits[kyc.status];
    
    if (amount > maxAmount) {
      return {
        allowed: false,
        reason: `KYC ${kyc.status}: max amount ${maxAmount} EUR`
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Get exclusions for player (combines KYC + RG)
   */
  async getExclusions(playerId: string): Promise<any> {
    // Get KYC status
    const kyc = await this.getKYCStatus(playerId);
    
    // Get RG status
    const rgResult = await query(
      'SELECT * FROM responsible_gaming WHERE player_id = $1',
      [playerId]
    );
    
    const rg = rgResult.rows[0];
    
    return {
      playerId,
      kyc: {
        status: kyc.status,
        verifiedAt: kyc.verifiedAt
      },
      responsibleGaming: {
        selfExcluded: rg?.self_excluded || false,
        selfExcludedUntil: rg?.self_excluded_until,
        coolingOff: rg?.cooling_off || false,
        coolingOffUntil: rg?.cooling_off_until
      }
    };
  }
}

export const kycService = new KYCService();