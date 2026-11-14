import Nav from '../components/Nav';
import Hero from '../components/landing/Hero';
import Capabilities from '../components/landing/Capabilities';
import Process from '../components/landing/Process';
import OnChain from '../components/landing/OnChain';
import LiveMetrics from '../components/landing/LiveMetrics';
import Providers from '../components/landing/Providers';
import Developers from '../components/landing/Developers';
import Statement from '../components/landing/Statement';
import Costs from '../components/landing/Costs';
import FinalCta from '../components/landing/FinalCta';
import Footer from '../components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Capabilities />
        <Process />
        <OnChain />
        <LiveMetrics />
        <Providers />
        <Developers />
        <Statement />
        <Costs />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
