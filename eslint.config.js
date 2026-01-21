import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  ignores: ['.output', '.wxt', 'node_modules'],
})
