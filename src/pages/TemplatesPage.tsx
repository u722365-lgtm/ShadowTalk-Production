import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Sparkles } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { PageTransition } from '@/components/PageTransition';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { CustomThemeDesigner } from '@/components/templates/CustomThemeDesigner';
import { MyCustomThemesPanel } from '@/components/templates/MyCustomThemesPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BUILTIN_TEMPLATES = [
  { id: 'default', name: 'ShadowTalk Dark', description: 'The classic dark theme with cyan accents', colors: { bg: '#030712', primary: '#6366F1', accent: '#A855F7' } },
  { id: 'midnight', name: 'Midnight Purple', description: 'Deep purple gradients with violet highlights', colors: { bg: '#0F0A1E', primary: '#8B5CF6', accent: '#EC4899' } },
  { id: 'ocean', name: 'Ocean Blue', description: 'Cool blue tones with teal accents', colors: { bg: '#0A0F1E', primary: '#3B82F6', accent: '#06B6D4' } },
  { id: 'forest', name: 'Forest Green', description: 'Nature-inspired greens with earthy tones', colors: { bg: '#0A1410', primary: '#10B981', accent: '#84CC16' } },
  { id: 'sunset', name: 'Sunset Orange', description: 'Warm orange and pink gradients', colors: { bg: '#1A0A0A', primary: '#F97316', accent: '#EC4899' } },
  { id: 'rose', name: 'Rose Gold', description: 'Elegant rose gold with soft pinks', colors: { bg: '#1A0A12', primary: '#F43F5E', accent: '#FB7185' } },
];

export default function TemplatesPage() {
  const [activeTemplate, setActiveTemplate] = useState<string>('default');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        meta={{
          title: 'UI Templates & Themes — ShadowTalk AI',
          description: 'Browse and customize UI themes for ShadowTalk AI. Choose from built-in templates or create your own custom theme.',
          canonical: 'https://www.shadowtalk-ai.com/templates',
          keywords: ['templates', 'themes', 'UI customization', 'dark mode themes'],
          ogType: 'website',
          twitterCard: 'summary',
          noIndex: false,
        }}
      />
      <Navigation />
      <PageTransition>
        <div className="max-w-6xl mx-auto py-12 px-6">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <Palette className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">UI Templates</h1>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
              Customize your ShadowTalk workspace. Choose a built-in theme or design your own.
            </p>
          </div>

          {/* Built-in Templates */}
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Built-in Themes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BUILTIN_TEMPLATES.map((tpl, idx) => (
                <motion.div
                  key={tpl.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                >
                  <TemplateCard
                    template={tpl}
                    isActive={activeTemplate === tpl.id}
                    onSelect={() => {
                      setActiveTemplate(tpl.id);
                      // Apply theme (visual preview only)
                      document.documentElement.style.setProperty('--primary', `${tpl.colors.primary}`);
                      document.documentElement.style.setProperty('--accent', `${tpl.colors.accent}`);
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Custom Theme Designer */}
          <div className="mb-12">
            <Card className="ios-glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-400" />
                  Custom Theme Designer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CustomThemeDesigner />
              </CardContent>
            </Card>
          </div>

          {/* My Custom Themes */}
          <div>
            <MyCustomThemesPanel />
          </div>

        </div>
      </PageTransition>
      <Footer />
    </div>
  );
}
