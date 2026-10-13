declare module '*.css?raw' {
  const styles: string;
  export default styles;
}

declare module '*.css?inline' {
  const styles: string;
  export default styles;
}
declare module '*.svg?raw' {
  const content: string;
  export default content;
}
