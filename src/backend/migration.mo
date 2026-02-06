import Map "mo:core/Map";
import Principal "mo:core/Principal";
import List "mo:core/List";

module {
  type OldLabelConfig = {
    width : Nat;
    height : Nat;
    margin : Nat;
    barcodeType : Text;
    customText : Text;
    textSize : Nat;
    font : Text;
    // Old version had position controls but did not persist them
    barcodePositionX : Nat;
    barcodePositionY : Nat;
    textPositionX : Nat;
    textPositionY : Nat;
    barcodeHeight : Nat;
    barcodeWidthScale : Nat;
    horizontalSpacing : Nat;
    centerContents : Bool;
  };

  type OldActor = {
    authenticatedSessions : Map.Map<Principal, Bool>;
    userProfiles : Map.Map<Principal, { name : Text; role : Text }>;
    labelConfigs : Map.Map<Text, OldLabelConfig>;
    printers : Map.Map<Text, { name : Text; connectionType : Text; status : Text }>;
    printHistory : [{ timestamp : Int; serialNumber : Text; labelType : Text; printer : Text }];
    errorLogs : [{ timestamp : Int; errorMessage : Text; printer : ?Text }];
    labelCounters : Map.Map<Text, Nat>;
    prefixesList : List.List<Text>;
    titleMappingsList : List.List<{ prefix : Text; title : Text }>;
  };

  type NewLabelConfig = OldLabelConfig;

  type NewActor = {
    authenticatedSessions : Map.Map<Principal, Bool>;
    userProfiles : Map.Map<Principal, { name : Text; role : Text }>;
    labelConfigs : Map.Map<Text, NewLabelConfig>;
    printers : Map.Map<Text, { name : Text; connectionType : Text; status : Text }>;
    printHistory : [{ timestamp : Int; serialNumber : Text; labelType : Text; printer : Text }];
    errorLogs : [{ timestamp : Int; errorMessage : Text; printer : ?Text }];
    labelCounters : Map.Map<Text, Nat>;
    prefixesList : List.List<Text>;
    titleMappingsList : List.List<{ prefix : Text; title : Text }>;
  };

  public func run(old : OldActor) : NewActor {
    // No actual data transformation needed
    old;
  };
};
