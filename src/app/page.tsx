
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

const CONTACT_EMAIL = "newlauren.94@gmail.com";
const CONTACT_PHONE = "2062067155";
const DISPLAY_PHONE = "(206) 206-7155";

const LOGIN_FOR_BOOKING = "/login?next=%2Fbook";
const SIGNUP_FOR_BOOKING = "/signup?next=%2Fbook";

const services = [
  {
    number: "01",
    id: "boarding",
    title: "Boarding",
    description:
      "A cozy stay in an employee’s home. We’ll ask how your dog does around other pets and match them with a caregiver who fits.",
    rates: [
      "Standard boarding — $40/night",
      "Solo care, no other pets — $60/night",
      "Pickup or drop-off — $20 each way",
    ],
    image:
      "https://cdn.shopify.com/s/files/1/0268/7349/5624/files/Is_boarding_traumatic_for_your_dog.jpg?v=1740765074&width=1200&height=500&crop=center",
    imageAlt: "Dogs spending time together in a boarding yard",
    href: "/booking-request?service=Boarding",
    action: "Ask about boarding",
    contactOnly: true,
  },
  {
    number: "02",
    id: "house-sitting",
    title: "House Sitting",
    description:
      "Comforting care in your own home, keeping your pet close to familiar routines while you’re away.",
    rates: ["Flexible overnight, 8 PM–7 AM — $80/night", "Dedicated overnight, 10 PM–7 AM — $100/night"],
    image:
      "https://images.unsplash.com/photo-1760791511030-ddad4c350cbb?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "Dog relaxing comfortably at home",
    href: "/booking-request?service=House%20Sitting",
    action: "Explore house sitting",
    contactOnly: false,
  },
  {
    number: "03",
    id: "drop-ins",
    title: "Drop-In Visits",
    description:
      "Thoughtful check-ins at home for dogs and cats: feeding, fresh water, play, and companionship. Medication support is available for an extra fee.",
    rates: ["30 minutes — $30", "45 minutes — $40", "Medication — +$5/visit"],
    image:
      "https://images.unsplash.com/photo-1616715655554-682697b9128b?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "Cat resting comfortably at home",
    href: "/booking-request?service=Drop-In%20Visits",
    action: "Book a drop-in",
    contactOnly: false,
  },
  {
    number: "04",
    id: "day-care",
    title: "Doggy Day Care",
    description:
      "A friendly, supervised group day from 8:00 AM–5:00 PM, with drop-off from 7:30 AM. Dogs can play and socialize together.",
    rates: ["Group day care — $35/day"],
    image:
      "https://images.unsplash.com/photo-1638766211645-505c1c678b2b?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "A group of dogs playing in a sunlit grassy park",
    href: "/booking-request?service=Doggy%20Day%20Care",
    action: "Book day care",
    contactOnly: false,
  },
  {
    number: "05",
    id: "dog-walking",
    title: "Dog Walking",
    description:
      "Fresh air, exercise, and one-on-one attention. Every walk is tailored to your dog’s pace and routine. Doggie bags are included.",
    rates: ["30 minutes — $30", "60 minutes — $50"],
    image:
      "https://images.unsplash.com/photo-1758633226887-8a1164f408a7?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "A person walking a dog through a grassy park",
    href: "/booking-request?service=Dog%20Walking",
    action: "Book a dog walk",
    contactOnly: false,
  },
];

const values = [
  {
    icon: "♡",
    title: "Care shaped around your pet",
    text: "Visits follow your pet’s routine, pace, and comfort, with attention to the little details that help them feel at home.",
  },
  {
    icon: "✳",
    title: "Attentive, gentle visits",
    text: "From feeding and fresh water to playtime and companionship, each check-in is centered on what your pet needs.",
  },
  {
    icon: "⌂",
    title: "Peace of mind for you",
    text: "Medication support is available during drop-ins for an additional $5 per visit, with clear instructions from you.",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    pet: "",
    service: "Dog Walking",
    message: "",
  });

  function updateForm(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = encodeURIComponent(
      `Paws in Motion inquiry — ${form.service}`
    );

    const body = encodeURIComponent(
      `New Paws in Motion inquiry\n\n` +
        `Name: ${form.name}\n` +
        `Email: ${form.email}\n` +
        `Pet's name: ${form.pet}\n` +
        `Interested in: ${form.service}\n\n` +
        `Message:\n${form.message || "No additional message."}`
    );

    window.location.href =
      `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main>
      {/* HEADER */}
      <header className="site-header">
        <a
          className="brand"
          href="#home"
          onClick={closeMenu}
          aria-label="Paws in Motion home"
        >
          <span className="brand-mark">
            p<span>✳</span>
          </span>

          <span className="brand-name">
            paws in motion
            <small>THOUGHTFUL PET CARE · SEATTLE</small>
          </span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <nav
          className={
            menuOpen ? "navigation navigation-open" : "navigation"
          }
        >
          <a href="#services" onClick={closeMenu}>
            Our Services
          </a>

          <a href={`mailto:${CONTACT_EMAIL}?subject=Join%20our%20team`} onClick={closeMenu}>
            Join Our Team
          </a>

          <a href="/login" onClick={closeMenu}>
            Sign In
          </a>

          <a href="/signup" onClick={closeMenu}>
            Create Account
          </a>

          
        </nav>
      </header>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-glow" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            YOUR NEIGHBORHOOD PET CARE PARTNER
          </div>

          <h1>
            Big love.
            <br />
            Little <span>paws.</span>
            <br />
            Every day.
          </h1>

          <p className="hero-description">
            Thoughtful pet care for the ones who make your house a home.
            More tail wags, more fresh air, and more peace of mind.
          </p>

          <div className="hero-actions">
            <a 
              className="button button-green" 
              href="#services"
              style={{ borderRadius: '9999px' }}
            >
              Explore services & pricing 
            </a>
          </div>

          <div className="hero-footnote">
            BOARDING · HOUSE SITTING · DROP-INS · DOGGY DAY CARE · DOG WALKING
          </div>
        </div>

        <div
          className="hero-photo"
          role="img"
          aria-label="A happy golden retriever enjoying the outdoors"
        >
          <div className="hero-photo-shade" />

          

          <div className="hero-photo-caption">
            A little fresh air goes a long way.
          </div>
        </div>

        <div className="hero-bottom">
          <span className="hero-bottom-location">
            SEATTLE, WASHINGTON
          </span>
        </div>
      </section>

      <section className="account-strip" aria-label="Customer account">
        <p>Pet details, appointment requests, and bookings—all in one place.</p>
        <div>
          <a href={SIGNUP_FOR_BOOKING}>Create an account</a>
          <a href={LOGIN_FOR_BOOKING}>Customer sign in</a>
        </div>
      </section>

      {/* SERVICES AND PRICING */}
      <section className="services section-pad" id="services">
          <div className="section-heading">
          <div>
            <div className="section-label">
              THOUGHTFUL CARE FOR EVERY KIND OF DAY
            </div>

            <h2>
              What kind of care
              <br />
              <span>does your pet need?</span>
            </h2>
          </div>

          <p>
            From neighborhood walks to cozy stays, find care that fits your
            pet&apos;s routine and comfort.
          </p>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" id={service.id} key={service.number}>
              <a
                className="service-photo"
                href={service.href}
                aria-label={`${service.action}: ${service.title}`}
              >
                <img
                  className="service-photo-image"
                  src={service.image}
                  alt={service.imageAlt}
                  loading="lazy"
                  decoding="async"
                />
              </a>

              <div className="service-card-content">
                <h3>{service.title}</h3>

                <p>{service.description}</p>

                <div className="service-prices">
                  {service.rates.map((rate) => (
                    <div className="service-price" key={rate}>
                      {rate}
                    </div>
                  ))}
                </div>

                <div className="service-card-bottom">
                  <span>Reviewed by our team before confirmation</span>

                  <a
                    className="book-now-button"
                    href={service.href}
                    aria-label={service.action}
                  >
                    Book Now
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ADDITIONAL PRICING DETAILS */}
        <details className="pricing-note">
          <summary className="pricing-note-heading">Service details, add-ons &amp; discounts</summary>
          <div className="pricing-note-content">

          <p>
            <strong>Dog Walking:</strong> Doggie bags are included.
           
          </p>

          <p>
            <strong>Bathing & Yard Cleanup Add-ons:</strong> Bathing and
            poop pickup are available by arrangement alongside a booked
            walk, drop-in, or overnight service. Bathing starts at $25 for
            small dogs, $35 for medium dogs, and $45+ for large dogs.
            Yard cleanup starts at $30. Ask about weekly cleanup visits.
          </p>

          <p>
            <strong>Vet Transportation:</strong> Before we can provide a
            ride, we&apos;ll confirm availability and the required signed
            authorization, appointment details, clinic contact, emergency
            contact, and relevant pet-care information with you.
          </p>

          <p>
            <strong>Doggy Day Care:</strong> Supervised group care is $35/day.
            Day care runs 8:00 AM–5:00 PM, with drop-off from 7:30–8:00 AM
            and pickup by 5:00 PM. We&apos;ll review each dog&apos;s comfort
            around other dogs before confirming.
          </p>

          <p>
            <strong>Boarding:</strong> Standard boarding is $40 per night;
            solo care with no other pets present is $60 per night. Pickup or drop-off is $20 each way
            within our service area. We&apos;ll confirm the home setup, pet
            compatibility, and transportation details before accepting a stay.
          </p>

          <p>
            <strong>Additional Pets:</strong> 10% off the second pet / 
            15% off the third pet.
          </p>

          <p>
            <strong>Repeat Customers:</strong> Our loyalty
            reward offers 10% off bookings on the
            second booking. Multi-pet discounts will be
            automatically applied in the booking system.
          </p>

          <p>
            <strong>Medication during Drop-In Visits:</strong> +$5 per visit.
            Please include the medication name, dose, timing, and instructions
            with your request.
          </p>

          <p>
            <strong>Flexible Overnight — $80/night:</strong> Care begins at
            8:00 PM after the caregiver&apos;s other appointments, and runs
            until 7:00 AM. Add up to two morning hours for $20, with
            departure by 9:00 AM.
          </p>

          <p>
            <strong>Dedicated Overnight — $100/night:</strong> Care runs
            from 10:00 PM to 7:00 AM without the caregiver leaving for other
            pet appointments.
          </p>
          </div>
        </details>
        
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark">
            p<span>✳</span>
          </span>

          <span className="brand-name">
            paws in motion
            <small>THOUGHTFUL PET CARE · SEATTLE</small>
          </span>
        </a>

        <div className="footer-links">
          <a href="#services">Services & Pricing</a>
          
          
          <a href="/signup">Create Account</a>
          <a href="/login">Sign In</a>
          <a
            href="https://www.facebook.com/profile.php?id=61595580778675"
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          
        </div>

        <div className="footer-contact">
          <a href={`tel:${CONTACT_PHONE}`}>
            Call {DISPLAY_PHONE}
          </a>

          <span>·</span>

          <a href={`sms:${CONTACT_PHONE}`}>Text us</a>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Paws in Motion</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
