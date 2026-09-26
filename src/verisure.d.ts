/**
 * The `verisure` package ships no types of its own. This is a minimal,
 * hand-written surface covering only what this plugin actually calls.
 */
declare module 'verisure' {
  export interface GraphqlOperation {
    operationName: string;
    variables?: Record<string, unknown>;
    query: string;
  }

  export interface VerisureInstallationConfig {
    giid: string;
    alias: string;
    locale: string;
    customerType?: string;
    dealerId?: string;
    subsidiary?: string | null;
    pinCodeLength?: number;
    address?: {
      street?: string;
      city?: string;
      postalNumber?: string;
    };
  }

  export class VerisureInstallation {
    giid: string;
    locale: string;
    config: VerisureInstallationConfig;
    client<T = any>(operation: GraphqlOperation): Promise<T>;
  }

  export default class Verisure {
    constructor(email?: string, password?: string, cookies?: string[]);
    host: string;
    cookies: string[];
    getToken(code?: string): Promise<string[]>;
    getCookie(prefix: string): string | undefined;
    getInstallations(): Promise<VerisureInstallation[]>;
    client<T = any>(operation: GraphqlOperation): Promise<T>;
  }
}
