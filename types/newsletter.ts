/** Firestore `newsletterSubscribers/{lowercasedEmail}` — doc ID is the email
 * itself, so a duplicate subscribe is a free `exists()` check with no query. */
export interface NewsletterSubscriber {
  email: string
  subscribedAt: string
}
