import { Request, Response } from 'express';
import { stripe } from '../../integrations/stripe/stripe.client';
import { env } from '../../config/env';

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { productType } = req.body;

    let priceAmount = 100; // 1.00 USD en cents par défaut
    let productName = "Pass Premium Visiteur (Accès Coordonnées)";

    if (productType === 'PRO_PREMIUM') {
      priceAmount = 15000; // 150.00 USD
      productName = "Abonnement Pro Premium (Mensuel)";
    }

    // Création de la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Redirection vers le frontend en cas de succès ou d'annulation
      success_url: `${env.CORS_ORIGIN.split(',')[0]}/cliniques?payment=success`,
      cancel_url: `${env.CORS_ORIGIN.split(',')[0]}/pass-premium-visiteur?payment=cancelled`,
      metadata: {
        productType,
      },
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error("Erreur Stripe :", error);
    return res.status(500).json({ message: "Erreur lors de la création de la session Stripe" });
  }
};