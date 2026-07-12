const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  // Supabase Edge Functions run on Deno and are checked/deployed by the
  // Supabase toolchain; Expo's Node resolver cannot resolve their URL imports.
  { ignores: ['dist/*', 'coverage/*', '.expo/*', 'supabase/functions/*'] },
]);
