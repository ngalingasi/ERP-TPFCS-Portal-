export interface OtpChannel {
  type:    'email' | 'sms';
  label:   string;
  display: string;
}

export interface AuthTokens {
  access:  { token: string; expires: string } | null;
  refresh: { token: string; expires: string } | null;
}

export interface SystemUser {
  user_id:             number | string;
  full_name:           string;
  email:               string;
  mobile?:             string | null;
  gender?:             string | null;
  avatar?:             string | null;
  role?:               string | null;
  status?:             string;
  must_change_password?: boolean | number;
  [key: string]: unknown;
}

export interface SoftwareProfile {
  id:          number;
  name:        string;
  description: string | null;
  api_base_url: string;
  app_url:     string;
  icon:        string;
  is_default:  boolean;
  is_active:   boolean;
  sort_order:  number;
  created_at:  string;
  updated_at:  string;
}

export interface MatchedSystem {
  profile: SoftwareProfile;
  user:    SystemUser;
  tokens:  AuthTokens;
}

export interface LoginResult {
  status:        boolean;
  message:       string;
  erpToken:      string;
  matchedSystems: MatchedSystem[];
  totalMatches:  number;
}
