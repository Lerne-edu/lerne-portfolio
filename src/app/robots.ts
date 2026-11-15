import type { MetadataRoute } from 'next'

// Only the public front page should appear in search engines; everything that holds or checks records stays out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/'],
      disallow: ['/admin', '/school', '/records', '/strengths', '/profile', '/store', '/notifications', '/plan', '/getprofily', '/public', '/verify/', '/api', '/change-password', '/mfa', '/parent-login', '/student-login', '/login'],
    }],
  }
}
