export default async function register(router, context) {
  const brw = await context.puppeteer?.launch({
    executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
    headless: true,
  });

  router.get('/t', (_request, response) => {
    response.json({
      ok: true,
      service: 't',
      puppeteer: typeof context.puppeteer?.launch === 'function',
      variables: context.variables
    });
  });
}
