// next.config.js
module.exports = {
  // @ts-expect-error-next-line
  webpack(config, { isServer }) {
    if (!isServer) {
      // Client: stub out canvas
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        canvas: false,
      };
    }
    // For both server & client: treat canvas as external
    config.externals = [
      ...(typeof config.externals === 'function'
        ? []
        : config.externals || []),
      { canvas: 'commonjs canvas' },
    ];
    return config;
  },
};
