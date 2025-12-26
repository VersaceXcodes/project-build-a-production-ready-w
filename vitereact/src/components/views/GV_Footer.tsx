import React from 'react';
import { Link } from 'react-router-dom';

const GV_Footer: React.FC = () => {
  // Static contact information (no backend calls needed)
  const contact_info = {
    whatsapp_number: '353874700356',
    email: 'info@sultanstamp.com',
    phone: '+353 87 470 0356',
    social_links: {
      instagram: 'https://www.instagram.com/sultanstamp/',
      linkedin: 'https://ie.linkedin.com/company/sultanstamp',
      tiktok: 'https://www.tiktok.com/@sultanstamp',
      facebook: 'https://www.facebook.com/share/19zEdk2zbW/',
      linktree: 'https://linktr.ee/Sultanstamp'
    }
  };

  const copyright_year = new Date().getFullYear();

  return (
    <>
      <footer className="bg-[#F7F7F7] border-t-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          {/* Main Footer Content - 3 column desktop, stacked mobile */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-8">
            
            {/* Section 1: Connect with Us (WhatsApp prominent) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect with Us</h3>
              
              {/* WhatsApp CTA Button - Yellow, most prominent */}
              <a
                href={`https://wa.me/${contact_info.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Message us on WhatsApp"
                className="inline-flex items-center justify-center w-full md:w-auto px-6 py-3 bg-[#FFD300] text-black font-semibold rounded-lg hover:bg-[#E5BE00] transition-all duration-200 shadow-md hover:shadow-lg gap-2"
              >
                {/* WhatsApp Icon SVG */}
                <svg 
                  className="w-5 h-5" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Message us on WhatsApp
              </a>
              
              {/* Email Link */}
              <div className="space-y-2">
                <a
                  href={`mailto:${contact_info.email}`}
                  className="block text-gray-700 hover:text-black text-base transition-colors"
                >
                  <span className="font-medium">Email:</span> {contact_info.email}
                </a>
                
                {/* Phone Link (clickable on mobile) */}
                <a
                  href={`tel:${contact_info.phone}`}
                  className="block text-gray-700 hover:text-black text-base transition-colors md:pointer-events-none"
                >
                  <span className="font-medium">Phone:</span> {contact_info.phone}
                </a>
              </div>
            </div>

            {/* Section 2: Legal Links */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal</h3>
              <nav aria-label="Legal links">
                <ul className="space-y-3">
                  <li>
                    <Link
                      to="/policies?section=privacy"
                      className="text-gray-700 hover:text-black text-sm transition-colors"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/policies?section=terms"
                      className="text-gray-700 hover:text-black text-sm transition-colors"
                    >
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/policies?section=refunds"
                      className="text-gray-700 hover:text-black text-sm transition-colors"
                    >
                      Refund Policy
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Section 3: Social Media Icons */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Follow Us</h3>
              <div className="flex gap-4 flex-wrap">
                
                {/* Linktree */}
                <a
                  href={contact_info.social_links.linktree}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our Linktree"
                  className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7.953 15.066c-.08.163-.08.324-.08.486.08.517.528.897 1.052.89h1.294v4.776c0 .486-.404.89-.89.89H6.577a.898.898 0 0 1-.889-.891v-4.774H.992c-.728 0-1.214-.729-.89-1.377l6.96-12.627a1.065 1.065 0 0 1 1.863 0l2.913 5.585-3.885 7.042zm15.945 0-6.96-12.627a1.065 1.065 0 0 0-1.862 0l-2.995 5.586 3.885 7.04c.081.164.081.326.081.487-.08.517-.529.897-1.052.89h-1.296v4.776c0 .486.405.89.89.89h2.914a.9.9 0 0 0 .892-.891v-4.774h4.612c.73 0 1.214-.729.89-1.377z"/>
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href={contact_info.social_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our Instagram"
                  className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href={contact_info.social_links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our LinkedIn"
                  className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>

                {/* TikTok */}
                <a
                  href={contact_info.social_links.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our TikTok"
                  className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                </a>

                {/* Facebook */}
                <a
                  href={contact_info.social_links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our Facebook"
                  className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Section: Copyright */}
          <div className="border-t border-gray-300 pt-8 mt-8">
            <p className="text-center text-sm text-gray-600">
              © {copyright_year} SultanStamp. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;