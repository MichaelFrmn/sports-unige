// Organisations offered by the SWITCHaai institution picker for this site
// (value = the picker's entityID). Taken from the picker page on 2026-11-12.
export interface Organisation {
  name: string;
  entityId: string;
}

export const ORGANISATIONS: Organisation[] = [
  { name: 'Université de Genève', entityId: 'https://idp.unige.ch/idp/shibboleth' },
  { name: 'EPFL', entityId: 'https://idp.epfl.ch/idp/shibboleth' },
  { name: 'Switch edu-ID', entityId: 'https://eduid.ch/idp/shibboleth' },
  { name: 'ETH Zurich', entityId: 'https://aai-logon.ethz.ch/idp/shibboleth' },
  { name: 'Università della Svizzera italiana', entityId: 'https://login2.usi.ch/idp/shibboleth' },
  { name: 'Universität Bern', entityId: 'https://aai-idp.unibe.ch/idp/shibboleth' },
  { name: 'Universität Liechtenstein', entityId: 'https://aai-logon.uni.li/idp/shibboleth' },
  { name: 'Universität Luzern', entityId: 'https://aai-logon.unilu.ch/idp/shibboleth' },
  { name: 'Universität St.Gallen', entityId: 'https://aai.unisg.ch/idp/shibboleth' },
  { name: 'Université de Bâle', entityId: 'https://aai-logon.unibas.ch/idp/shibboleth' },
  { name: 'Université de Fribourg', entityId: 'https://aai.unifr.ch/idp/shibboleth' },
  { name: 'Université de Lausanne', entityId: 'https://aai.unil.ch/idp/shibboleth' },
  { name: 'Université de Neuchâtel', entityId: 'https://aai-login.unine.ch/idp/shibboleth' },
  { name: 'University of Zurich', entityId: 'https://aai-idp.uzh.ch/idp/shibboleth' },
  { name: 'HES-SO', entityId: 'https://aai-logon.hes-so.ch/idp/shibboleth' },
  { name: 'IHEID (Graduate Institute)', entityId: 'https://idp.graduateinstitute.ch/idp/shibboleth' },
];

export function organisationName(entityId: string): string {
  return ORGANISATIONS.find((o) => o.entityId === entityId)?.name ?? entityId;
}
