let pdfRuntimePromise: Promise<typeof import('pdfjs-dist')> | undefined

export function loadPdfRuntime(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default
      return pdfjs
    }).catch((error) => {
      pdfRuntimePromise = undefined
      throw error
    })
  }
  return pdfRuntimePromise
}
