export default function register(router, context) {
  router.get('/service', (_request, response) => {
    response.json({
      ok: true,
      service: 'service',
      variables: context.variables
    });
  });
}
