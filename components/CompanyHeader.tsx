import { View, Text, StyleSheet, Image } from 'react-native';
import { Phone, MapPin, Building2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CompanyHeader() {
  const { company } = useApp();
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState<string | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from('companies')
      .select('twilio_phone_number, postal_code, address')
      .eq('id', company.id)
      .single()
      .then(({ data }) => {
        if (data?.twilio_phone_number) setTwilioNumber(data.twilio_phone_number);
        if (data?.postal_code) setPostalCode(data.postal_code);
      });
  }, [company?.id]);

  if (!company) return null;

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {company.logo ? (
          <Image source={{ uri: company.logo }} style={styles.logo} />
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: company.brandColor || '#2563EB' }]}>
            <Building2 size={20} color="#fff" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.companyName} numberOfLines={1}>{company.name}</Text>
          {company.address ? (
            <View style={styles.row}>
              <MapPin size={11} color="#9CA3AF" />
              <Text style={styles.detail}>{company.address}{postalCode ? `, ${postalCode}` : ''}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {twilioNumber ? (
        <View style={styles.phoneBadge}>
          <Phone size={12} color="#2563EB" />
          <Text style={styles.phoneText}>{formatPhone(twilioNumber)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  detail: {
    fontSize: 11,
    color: '#9CA3AF',
    flex: 1,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
});
