type OriginRule = { type: 'exact'; value: string } | { type: 'pattern'; value: RegExp };

const originRuleCache = new Map<string, OriginRule[]>();

export function isAllowedOrigin(origin: string, configuredOrigins: string): boolean {
  return getOriginRules(configuredOrigins).some((rule) => {
    if (rule.type === 'exact') {
      return rule.value === origin;
    }

    return rule.value.test(origin);
  });
}

function getOriginRules(configuredOrigins: string): OriginRule[] {
  const cached = originRuleCache.get(configuredOrigins);
  if (cached) {
    return cached;
  }

  const rules = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map<OriginRule>((origin) => {
      if (!origin.includes('*')) {
        return { type: 'exact', value: origin };
      }

      const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+');
      return { type: 'pattern', value: new RegExp(`^${escaped}$`) };
    });

  originRuleCache.set(configuredOrigins, rules);
  return rules;
}
