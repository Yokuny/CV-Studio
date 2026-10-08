const authority = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const scope = 'https://outlook.office.com/SMTP.Send offline_access';

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class OutlookOAuthError extends Error {
  constructor(public readonly code: string) {
    const messages: Record<string, string> = {
      authorization_declined: 'A autorização Microsoft foi recusada. Inicie a conexão novamente.',
      access_denied: 'A autorização Microsoft foi recusada. Inicie a conexão novamente.',
      expired_token: 'O código Microsoft expirou. Clique em Entrar com Microsoft para gerar outro.',
      invalid_grant: 'A autorização Microsoft expirou ou foi revogada. Entre com Microsoft novamente.',
      invalid_client:
        'Confira o client ID e habilite contas pessoais e fluxos de cliente público no aplicativo Microsoft.',
      unauthorized_client:
        'O aplicativo Microsoft precisa aceitar contas pessoais e permitir fluxos de cliente público.',
      invalid_scope: 'O aplicativo Microsoft precisa da permissão delegada SMTP.Send do Exchange Online.',
      network: 'Não foi possível acessar a Microsoft. Confira sua conexão e tente novamente.',
      invalid_response: 'A Microsoft retornou uma resposta de autorização inválida. Tente novamente.',
    };
    super(messages[code] ?? 'Não foi possível autorizar a conta Microsoft. Confira o aplicativo e tente novamente.');
  }
}

/** Public client device flow: no client secret, password, or tokens enter the browser. */
export function outlookOAuth(fetcher: typeof fetch = fetch, now = Date.now) {
  const request = async (endpoint: string, body: Record<string, string>) => {
    let response: Response;
    let data: Record<string, unknown>;
    try {
      response = await fetcher(`${authority}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      data = await response.json();
    } catch {
      throw new OutlookOAuthError('network');
    }
    if (!data || typeof data !== 'object') throw new OutlookOAuthError('invalid_response');
    if (typeof data.error === 'string') throw new OutlookOAuthError(data.error);
    if (!response.ok) throw new OutlookOAuthError('invalid_response');
    return data;
  };
  const tokens = (data: Record<string, unknown>, previousRefresh?: string): OutlookTokens => {
    const refreshToken = data.refresh_token ?? previousRefresh;
    if (
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      typeof refreshToken !== 'string' ||
      !refreshToken ||
      typeof data.expires_in !== 'number' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new OutlookOAuthError('invalid_response');
    return { accessToken: data.access_token, refreshToken, expiresAt: now() + data.expires_in * 1000 };
  };
  return {
    async start(clientId: string) {
      const data = await request('devicecode', { client_id: clientId, scope });
      if (
        typeof data.device_code !== 'string' ||
        !data.device_code ||
        typeof data.user_code !== 'string' ||
        !data.user_code ||
        typeof data.verification_uri !== 'string' ||
        typeof data.expires_in !== 'number' ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      )
        throw new OutlookOAuthError('invalid_response');
      let url: URL;
      try {
        url = new URL(data.verification_uri);
      } catch {
        throw new OutlookOAuthError('invalid_response');
      }
      if (
        url.protocol !== 'https:' ||
        !['microsoft.com', 'www.microsoft.com', 'login.microsoftonline.com'].includes(url.hostname)
      )
        throw new OutlookOAuthError('invalid_response');
      return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: url.href,
        expiresAt: now() + Math.min(data.expires_in, 1800) * 1000,
        interval: typeof data.interval === 'number' && Number.isFinite(data.interval) ? Math.max(5, data.interval) : 5,
      };
    },
    async poll(clientId: string, deviceCode: string) {
      return tokens(
        await request('token', {
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      );
    },
    async refresh(clientId: string, refreshToken: string) {
      return tokens(
        await request('token', {
          client_id: clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope,
        }),
        refreshToken,
      );
    },
  };
}
