export = index;
declare class index {
  constructor(options: any);
  options: any;
  addFileToAssets(filename: any, compilation: any): any;
  appendHash(url: any, hash: any): any;
  apply(compiler: any): void;
  applyPluginsAsyncWaterfall(compilation: any): any;
  createHtmlTag(tagDefinition: any): any;
  evaluateCompilationResult(compilation: any, source: any): any;
  executeTemplate(templateFunction: any, chunks: any, assets: any, compilation: any): any;
  filterChunks(chunks: any, includedChunks: any, excludedChunks: any): any;
  generateHtmlTags(assets: any): any;
  getAssetFiles(assets: any): any;
  getFullTemplatePath(template: any, context: any): any;
  getMetaTags(): any;
  getTemplateParameters(compilation: any, assets: any): any;
  htmlWebpackPluginAssets(compilation: any, chunks: any): any;
  injectAssetsIntoHtml(html: any, assets: any, assetTags: any): any;
  isHotUpdateCompilation(assets: any): any;
  postProcessHtml(html: any, assets: any, assetTags: any): any;
  sortChunks(chunks: any, sortMode: any, compilation: any): any;
}
