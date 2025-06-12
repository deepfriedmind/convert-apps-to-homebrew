declare module 'bundle-name' {
  /**
   * Get the display name of a bundle identifier synchronously
   */
  function sync(bundleId: string): null | string

  /**
   * Get the display name of a bundle identifier asynchronously
   */
  function bundleName(bundleId: string): Promise<null | string>

  export = bundleName
  export { sync }
}
