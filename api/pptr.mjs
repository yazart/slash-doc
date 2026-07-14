export default function register(router, context) {
  router.get('/pptr', async (_request, response) => {
    // const browser = await context.puppeteer.launch({});

    response.json({
      ok: true,
      service: 'pptr',
      puppeteer: typeof context.puppeteer?.launch === 'function',
      variables: context.variables
    });
  });
}
