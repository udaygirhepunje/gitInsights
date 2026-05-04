import { useEffect, useState } from 'react';

import type { GitHubErrorKind } from '../api/errors';
import { getLastSsoRequired, subscribeSsoRequired } from '../api/events';

type SsoRequiredInfo = Extract<GitHubErrorKind, { kind: 'sso-required' }>;

export function useSsoRequired(): SsoRequiredInfo | null {
  const [info, setInfo] = useState<SsoRequiredInfo | null>(() => getLastSsoRequired());

  useEffect(() => {
    return subscribeSsoRequired(setInfo);
  }, []);

  return info;
}
