module.exports = ({ config }) => {
  if (process.env.METVAGE_LOCAL_TEST !== '1') return config

  const { googleServicesFile, ...android } = config.android
  return {
    ...config,
    name: 'Metvage Test',
    android: { ...android, package: 'com.metvage.acceptance' },
    extra: { ...config.extra, pushNotificationsEnabled: false, localInstanceHost: 'localhost:18080' },
  }
}
